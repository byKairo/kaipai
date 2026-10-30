'use client';

import { aiFetch } from '../../lib/ai-transport';
import { cropGeneratedImage } from '../../lib/image-encoding';

import { useState, useRef, useEffect, type MutableRefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { captureImageTarget, imageScopePreference, scopedImageBriefs, type AiPlanOptions, type ImageTarget } from '../../lib/ai-workbench';
import { requestAi } from '../../lib/providers';
import { prepareLayoutReview, previewLayout, suggestionSignature, excludeIgnored, type LayoutReview } from '../../lib/layout-review';
import { saveGeneratedImage, type GeneratedImage } from '../../lib/generated-images';
import { allStyles as styles, newStyles } from '../../lib/styles';
import type { LocalAsset } from '../../lib/assets';
import type { ApiProfile, ApiProfileRoles } from '../../lib/api-profiles';
import type { AiRevision, useAiState } from './use-ai-state';
import type { useRequestScope } from './use-request-scope';

type Context = {
  state: ReturnType<typeof useAiState>;
  content: string;
  articleId: string;
  style: number;
  accent: string;
  apiProfiles: ApiProfile[];
  apiRoles: ApiProfileRoles;
  apiProvider: string;
  apiModel: string;
  textApiKey: string;
  textBaseUrl: string;
  assets: LocalAsset[];
  brandAvatarAssetId: string;
  brandQrAssetId: string;
  brandName: string;
  brandNote: string;
  requestScope: ReturnType<typeof useRequestScope>;
  richEditorRef: MutableRefObject<Editor | null>;
  chooseStyle: (index: number) => void;
  loadMarkdown: (markdown: string) => void;
  say: (message: string) => void;
  setApiOpen: (open: boolean) => void;
};

/** Owns generation, review and guarded application of AI results. */
export function useAiActions(context: Context) {
  const { content, articleId, style, accent, apiProfiles, apiRoles, apiProvider, apiModel, textApiKey, textBaseUrl,
    assets, brandAvatarAssetId, brandQrAssetId, brandName, brandNote, requestScope,
    richEditorRef, chooseStyle, loadMarkdown, say, setApiOpen } = context;
  const { setAiImageCards, setSavedGeneratedImages, setAiResultMode, setAiPhase, setAiRecommendation,
    setAiSummary, setAiTitleOptions, setAiSuggestions, setAiImageBriefs, setAiRevision,
    setRevisionInstruction, aiRevision } = context.state;
  const appliedMarkdown = useRef<string | null>(null);
  const ignored = useRef(new Map<string, Set<string>>());
  useEffect(() => {
    if (appliedMarkdown.current !== null && content !== appliedMarkdown.current) { appliedMarkdown.current = null; setAiPhase('entry'); }
  }, [content, articleId, setAiPhase]);
  const [planError, setPlanError] = useState('');
  const [pendingPlan, setPendingPlan] = useState<{ markdown: string; original: string; style: number; review: LayoutReview; selected: string[]; selectionError: string } | null>(null);
  const lastPlan = useRef<{ mode: 'full' | 'layout' | 'images' | 'title'; options: AiPlanOptions }>({ mode: 'layout', options: {} });
  const styleDef = styles[style];
  const generateAiImage = async (id: string, brief: string, prompt: string, ratio = '4:3', visualStyle = '跟随文章风格') => {
    const profile = apiProfiles.find((item) => item.id === apiRoles.imageId);
    const selectedModel = profile?.modelConfigs.find((item) => item.id === apiRoles.imageModelId) || profile?.modelConfigs.find((item) => item.capabilities.includes('image-generation'));
    if (!profile || !profile.models.image) {
      setAiImageCards((cards) => cards.map((card) => card.id === id ? { ...card, status: 'error', error: '请在 AI 服务配置中填写配图模型。' } : card));
      return;
    }
    const isCurrent = requestScope.begin(`image:${id}`);
    setAiImageCards((cards) => cards.map((card) => card.id === id ? { ...card, status: 'loading', error: '' } : card));
    try {
      const response = await aiFetch('/api/ai/image', { signal: isCurrent.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: profile.provider, baseUrl: profile.baseUrl, apiKey: profile.apiKey, model: selectedModel?.modelId || profile.models.image, adapter: selectedModel?.adapter || profile.adapters.image, aspectRatio: ratio, prompt: `${prompt}\n画面用于中文公众号文章，目标比例 ${ratio}，视觉风格：${visualStyle === '跟随文章风格' ? styles[style].name : visualStyle}。文章主题色：${accent}；参考排版视觉语言：${styles[style].grammar}。清晰、简洁，不含水印；图片内文字严格遵循画面要求。构图只保留一个核心视觉主体，围绕文章观点建立明确的视觉隐喻或关系，避免装饰堆砌、通用PPT模板与整页文章截图。文章语境：${content.replace(/data:image\/[^\s)]+/g, '').slice(0, 3500)}。文章主题：${content.split('\n').find(Boolean)?.slice(0, 90) || ''}` }) });
      const result = await response.json().catch(() => null);
      if (!isCurrent()) return;
      if (!response.ok || !result?.ok || typeof result.src !== 'string') throw new Error(result?.error || '图片生成失败，请确认本地预览服务仍在运行。');
      const src = await cropGeneratedImage(result.src, ratio, isCurrent.signal);
      if (!isCurrent()) return;
      const image: GeneratedImage = { id: crypto.randomUUID(), src, brief, prompt, createdAt: Date.now() };
      await saveGeneratedImage(image, isCurrent.signal);
      if (!isCurrent()) return;
      setSavedGeneratedImages((items) => [image, ...items.filter(item => item.id !== image.id)]);
      setAiImageCards((cards) => cards.map((card) => card.id === id ? { ...card, src: image.src, status: 'done' } : card));
    } catch (error) {
      if (!isCurrent()) return;
      const message = error instanceof TypeError && /fetch/i.test(error.message) ? '无法连接本地生图服务，请刷新页面或重启本地预览。' : error instanceof Error ? error.message : '图片生成失败';
      setAiImageCards((cards) => cards.map((card) => card.id === id ? { ...card, status: 'error', error: message } : card));
    } finally { isCurrent.finish(); }
  };
  const prepareAiImages = (briefs: string[], options: AiPlanOptions = {}, target?: ImageTarget) => {
    const scoped = scopedImageBriefs(briefs, options.imageScope || 'article', target);
    const cards = scoped.map((brief) => ({ id: crypto.randomUUID(), brief, prompt: `${brief.split('｜').slice(1).join('｜') || brief}${options.imageInstruction ? `\n额外要求：${options.imageInstruction}` : ''}`, src: '', target, status: 'idle' as const }));
    setAiImageCards(cards);

  };
  const applyAiMarkdown = (markdown: string) => {
    const editor = richEditorRef.current;
    const before = editor?.getJSON();
    const countTables = (node: { type?: string; content?: Array<{ type?: string; content?: unknown[] }> } | undefined): number => !node ? 0 : (node.type === 'table' ? 1 : 0) + (node.content || []).reduce((sum, child) => sum + countTables(child as typeof node), 0);
    loadMarkdown(markdown);
    if (editor && countTables(editor.getJSON()) < countTables(before)) {
      editor.commands.setContent(before!);
      say('检测到表格解析异常，已保留原文表格；可以手动调整其他段落');
      return false;
    }
    return true;
  };
  const runAiPlan = async (mode: 'full' | 'layout' | 'images' | 'title' = 'full', options: AiPlanOptions = {}) => {
    if (apiProvider === '本地模拟' || !textApiKey.trim()) { setApiOpen(true); say('AI 功能需连接自己的服务；本地风格和组件可直接使用。'); return; }
    if (!content.trim()) { say('请先输入文章内容'); return; }
    const editor = richEditorRef.current;
    const target = mode === 'images' && options.imageScope === 'selection' && editor ? captureImageTarget(editor.state.doc, editor.state.selection, articleId) : undefined;
    if (mode === 'images' && options.imageScope === 'selection' && !target) { say('请先在正文中点击一个段落，或选中要配图的文字'); return; }
    lastPlan.current = { mode, options };
    const requestedStyle = styles.findIndex(item => item.id === options.styleId);
    const isCurrent = requestScope.begin('plan');
    setPlanError('');
    setPendingPlan(null);
    setAiResultMode(mode);
    setAiPhase('running');
    const provider = apiProvider === 'OpenRouter' || apiProvider === 'OpenAI' || apiProvider === 'Anthropic' || apiProvider === 'Gemini' || apiProvider === 'DeepSeek' || apiProvider === 'Qwen' || apiProvider === 'Kimi' || apiProvider === 'Grok' ? apiProvider : 'Custom';
    const brandAssets = [assets.find((asset) => asset.id === brandAvatarAssetId)?.name, assets.find((asset) => asset.id === brandQrAssetId)?.name].filter(Boolean).join('、');
    try {
      const result = await requestAi({ provider, apiKey: textApiKey, endpoint: textBaseUrl, model: apiModel || undefined, adapter: apiProfiles.find((item) => item.id === apiRoles.textId)?.modelConfigs.find((item) => item.id === apiRoles.textModelId)?.adapter as 'openai-chat' | 'openai-responses' | undefined || apiProfiles.find((item) => item.id === apiRoles.textId)?.adapters.text, operation: mode, article: content, preferences: `当前 Style：${styleDef.name}（${styleDef.grammar}）。${requestedStyle >= 0 ? `用户指定文章风格：${styles[requestedStyle].id}，请保持该风格。` : ''}${mode === 'images' ? imageScopePreference(options.imageScope || 'article', target) : ''}${options.imageInstruction ? `配图额外要求：${options.imageInstruction.slice(0, 800)}。` : ''}可选文章风格 ID：${newStyles.map(item => `${item.id}（${item.name}：${item.grammar}）`).join('；')}。品牌：${brandName}；${brandNote}；关联素材：${brandAssets || '无'}。作者已忽略的建议（不要重复）：${JSON.stringify(Array.from(ignored.current.get(articleId) || [])).slice(0, 1200)}`, prompt: '' }, isCurrent.signal);
      if (!isCurrent()) return;
      if (!result.ok) { setPlanError(result.error); setAiPhase('entry'); return; }
      try {
        const plan = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as { style?: string; formattedMarkdown?: string; titles?: string[]; suggestions?: string[]; imageBriefs?: string[] };
        const nextStyle = styles.findIndex((item) => item.id === plan.style);
        const selectedStyle = requestedStyle >= 0 ? requestedStyle : nextStyle >= 0 ? nextStyle : style;
        setAiRecommendation(selectedStyle);
        let formatted = content;
        if (mode === 'full' || mode === 'layout') {
          const review = excludeIgnored(prepareLayoutReview(plan, content), ignored.current.get(articleId) || new Set<string>());
          const selected: string[] = [];
          // Start with compatible layout-only changes; wording remains opt-in.
          for (const suggestion of review.suggestions) {
            if (!['split', 'merge', 'heading', 'emphasis'].includes(suggestion.kind)) continue;
            try { previewLayout(content, review.suggestions, [...selected, suggestion.id]); selected.push(suggestion.id); } catch { /* Conflicting suggestions remain visible and unchecked. */ }
          }
          formatted = previewLayout(content, review.suggestions, selected);
          setPendingPlan({ markdown: formatted, original: content, style: selectedStyle, review, selected, selectionError: '' });
        }
        const titles = Array.isArray(plan.titles) ? plan.titles.filter((item): item is string => typeof item === 'string').slice(0, 3) : [];
        const images = Array.isArray(plan.imageBriefs) ? plan.imageBriefs.filter((item): item is string => typeof item === 'string').map((item) => item.slice(0, 700)).slice(0, 3) : [];
        setAiTitleOptions(titles);
        setAiImageBriefs(images);
        if (mode === 'images' || mode === 'full') prepareAiImages(images, options, target);
        setAiSuggestions([]);
        setAiSummary(mode === 'images' ? 'Kairo Design 已准备画面方向；生成后请检查图片文字和细节。' : mode === 'title' ? '已生成标题建议。' : `建议使用「${styles[selectedStyle].name}」，请预览后应用。`);
        setAiPhase('ready');
      } catch (error) { setPlanError(error instanceof Error ? error.message : '模型方案无法识别；正文未修改，不会改用基础排版。'); setAiPhase('entry'); }
    } finally { isCurrent.finish(); }
  };
  const makeRevision = async (revision: AiRevision, instruction = '') => {
    setAiRevision({ ...revision, status: 'running', error: '' });
    if (apiProvider === '本地模拟' || !textApiKey.trim()) { setAiRevision(null); setApiOpen(true); return; }
    const provider = apiProvider === 'OpenRouter' || apiProvider === 'OpenAI' || apiProvider === 'Anthropic' || apiProvider === 'Gemini' || apiProvider === 'DeepSeek' || apiProvider === 'Qwen' || apiProvider === 'Kimi' || apiProvider === 'Grok' ? apiProvider : 'Custom';
    const isCurrent = requestScope.begin('revision');
    const task = revision.kind === 'title' ? '给原文提出 3 个准确、不夸张、方向不同的中文标题。只返回 JSON：{"titles":["标题1","标题2","标题3"]}。' : '在不改变事实、原意和语气的前提下润色选中文字。只返回改后的文字，不加解释。';
    try {
      const result = await requestAi({ provider, apiKey: textApiKey, endpoint: textBaseUrl, model: apiModel || undefined, adapter: apiProfiles.find((item) => item.id === apiRoles.textId)?.modelConfigs.find((item) => item.id === apiRoles.textModelId)?.adapter as 'openai-chat' | 'openai-responses' | undefined || apiProfiles.find((item) => item.id === apiRoles.textId)?.adapters.text, system: '你是认真负责的中文编辑。', prompt: `${task}\n${revision.proposal ? `上一版建议：${revision.proposal}\n` : ''}${instruction ? `额外要求：${instruction}\n` : ''}原文：\n${revision.original}`, action: 'plan' }, isCurrent.signal);
      if (!isCurrent()) return;
      if (!result.ok) { setAiRevision({ ...revision, status: 'error', error: result.error }); return; }
      if (revision.kind === 'title') {
        try {
          const parsed = JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
          const alternatives = Array.isArray(parsed.titles) ? parsed.titles.filter((item: unknown): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, 3) : [];
          setAiRevision({ ...revision, alternatives, proposal: alternatives[0] || revision.original, status: 'ready' });
        } catch { setAiRevision({ ...revision, proposal: result.text.trim(), alternatives: [result.text.trim()], status: 'ready' }); }
      } else setAiRevision({ ...revision, proposal: result.text.trim(), alternatives: [], status: 'ready' });
    } finally { isCurrent.finish(); }
  };
  const runAiTool = async (tool: 'layout' | 'images' | 'polish' | 'title') => {
    if (apiProvider === '本地模拟' || !textApiKey.trim()) { setApiOpen(true); say('润色与标题建议需连接文章模型，原文保持不变。'); return; }
    if (tool === 'layout' || tool === 'images') { await runAiPlan(tool); return; }
    const editor = richEditorRef.current;
    if (!editor) { say('编辑器尚未就绪'); return; }
    let from = editor.state.selection.from;
    let to = editor.state.selection.to;
    let wasHeading = false;
    let insertAtStart = false;
    if (tool === 'polish' && from === to) { say('请先在编辑区选中要润色的文字'); return; }
    if (tool === 'title') {
      let foundHeading = false;
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.attrs.level === 1) {
          from = pos + 1; to = from + node.textContent.length; wasHeading = true; foundHeading = true; return false;
        }
        return true;
      });
      if (!foundHeading) {
        insertAtStart = true;
        from = 1;
        to = Math.min(editor.state.doc.content.size, 1 + (editor.state.doc.firstChild?.textContent.length || 0));
      }
    }
    const original = editor.state.doc.textBetween(from, to, '\n').trim();
    if (!original) { say('请先写入文章标题或选中正文'); return; }
    const revision: AiRevision = { kind: tool, original, proposal: '', alternatives: [], from, to, wasHeading, insertAtStart, status: 'running' };
    setRevisionInstruction('');
    await makeRevision(revision);
  };
  const applyRevision = () => {
    const editor = richEditorRef.current;
    if (!editor || !aiRevision?.proposal.trim()) return;
    if (!aiRevision.insertAtStart && editor.state.doc.textBetween(aiRevision.from, aiRevision.to, '\n').trim() !== aiRevision.original) { say('原文已有变化，请重新生成建议'); return; }
    if (aiRevision.insertAtStart) {
      editor.chain().focus().insertContentAt(0, { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: aiRevision.proposal.trim() }] }).run();
      setAiRevision(null);
      say('已添加文章标题');
      return;
    }
    editor.chain().focus().insertContentAt({ from: aiRevision.from, to: aiRevision.to }, aiRevision.proposal.trim()).run();
    if (aiRevision.kind === 'title' && !aiRevision.wasHeading) editor.chain().focus().setTextSelection(aiRevision.from).setHeading({ level: 1 }).run();
    setAiRevision(null);
    say('已应用修改');
  };

  const ignoreSuggestion = (id: string) => {
    setPendingPlan(plan => {
      if (!plan) return plan;
      const suggestion = plan.review.suggestions.find(item => item.id === id);
      if (!suggestion) return plan;
      const rejected = ignored.current.get(articleId) || new Set<string>();
      rejected.add(suggestionSignature(suggestion)); ignored.current.set(articleId, rejected);
      const removed = new Set([id]);
      let changed = true;
      while (changed) { changed = false; for (const item of plan.review.suggestions) if (!removed.has(item.id) && item.depends_on.some(dep => removed.has(dep))) { removed.add(item.id); changed = true; } }
      const suggestions = plan.review.suggestions.filter(item => !removed.has(item.id)).map(item => ({ ...item, conflicts_with: item.conflicts_with.filter(other => !removed.has(other)) }));
      const selected = plan.selected.filter(item => !removed.has(item));
      try { return { ...plan, review: { ...plan.review, suggestions }, selected, markdown: previewLayout(plan.original, suggestions, selected), selectionError: '' }; }
      catch { return { ...plan, review: { ...plan.review, suggestions }, selected: [], markdown: plan.original, selectionError: '' }; }
    });
  };
  const cancelPlan = () => { requestScope.cancel('plan'); setAiPhase('entry'); };
  const toggleSuggestion = (id: string) => {
    setPendingPlan(plan => {
      if (!plan) return plan;
      const selected = plan.selected.includes(id) ? plan.selected.filter(item => item !== id) : [...plan.selected, id];
      try { return { ...plan, selected, markdown: previewLayout(plan.original, plan.review.suggestions, selected), selectionError: '' }; }
      catch (error) { return { ...plan, selected, markdown: plan.original, selectionError: error instanceof Error ? error.message : '建议无法组合' }; }
    });
  };
  const applyPlan = () => {
    if (!pendingPlan || pendingPlan.selectionError) return false;
    if (content !== pendingPlan.original) { say('正文已修改，请重新生成方案后应用'); return false; }
    if (!applyAiMarkdown(pendingPlan.markdown)) return false;
    appliedMarkdown.current = richEditorRef.current?.getMarkdown() || pendingPlan.markdown;
    chooseStyle(pendingPlan.style); setPendingPlan(null); say('排版已应用，可以直接复制正文或按需配图'); return true;
  };
  return { ignoreSuggestion, cancelPlan, toggleSuggestion, planError, pendingPlan, setPendingPlan, applyPlan, generateAiImage, runAiPlan, retryAiPlan: () => runAiPlan(lastPlan.current.mode, lastPlan.current.options), makeRevision, runAiTool, applyRevision };
}
