'use client';
import PlatformStatus from './platform-status';
import { restoreApiProfiles } from '../lib/credential-client';

import { prepareWechatPublication } from '../lib/wechat-publication';
import { createArticleImagePackage } from '../lib/article-image-download';

import { useAppearanceState } from './workspace/use-appearance-state';
import { useAiState } from './workspace/use-ai-state';
import { useRequestScope } from './workspace/use-request-scope';
import { useArticleAutosave } from './workspace/use-article-autosave';
import { ArticlePreview } from './workspace/article-preview';
import { EditorToolbar } from './workspace/editor-toolbar';
import { isImageTargetCurrent } from '../lib/ai-workbench';
import { useAiActions } from './workspace/use-ai-actions';
import { useArticleReview } from './workspace/use-article-review';
import { ArticleReviewPopover } from './workspace/article-review-popover';
import reviewUi from './workspace/article-review.module.css';
import type { AiProviderId } from '../lib/providers';
import { sample } from './workspace/sample-article';
import { normalizeHeadingStyle, barLabels, barPrefixes, normalizedPresetAppearance } from './workspace/appearance';
import React, { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './prototype-rebuild.css';
import './neo-ux.css';
import { getActiveArticleId, listArticles, rememberActiveArticle } from '../lib/storage';
import type { ArticleDocument, ArticleRecord } from '../lib/document';
import { makeStandaloneHtml } from '../lib/export';
import { importDocx } from '../lib/importers';
import { wechatResourceNotice } from '../lib/wechat-resources';
import { styles, getStyleComponentDefaults } from '../lib/styles';
import { resolveArticleHighlight } from '../lib/article-styles/highlight';
import { listAssets, type LocalAsset } from '../lib/assets';
import { normalizeMarkdownTables } from '../lib/ai-layout';
import ApiSettings from './api-settings';
import { writeApiProfiles, type ApiProfile, type ApiProfileRoles } from '../lib/api-profiles';
import { listGeneratedImages } from '../lib/generated-images';
import RichEditor from './rich-editor';
import { htmlToPlainText, markdownToWechat } from '../lib/wechat-html';
import { enforceWechatCompliance } from '../lib/wechat-compliance';
import V091Sidebar from './v091-sidebar';
import type { Editor } from '@tiptap/core';
import './studio.css';
import './workspace-v3.css';

type Tab = 'ai' | 'layout' | 'components' | 'drafts';
type Ui = 'neo2' | 'tactile';
type SavedStylePreset = { id: string; name: string; note: string; styleId: string; appearance: NonNullable<ArticleRecord['appearance']>; updatedAt: number };









export default function Page() {
  const [tab, setTab] = useState<Tab>('ai');
  const [ui, setUi] = useState<Ui>('neo2');

  useEffect(() => {
    document.documentElement.dataset.ui = ui === 'tactile' ? 'tactile' : 'neo2';
    document.body.dataset.ui = ui === 'tactile' ? 'tactile' : 'neo2';
  }, [ui]);
  const [mobileView, setMobileView] = useState<'styles' | 'edit' | 'preview'>('edit');
  const [content, setContent] = useState(sample);
  const { style, setStyle, accent, setAccent, markerColor, setMarkerColor, variant, setVariant, fontSize, setFontSize, lineHeight, setLineHeight, padX, setPadX, padY, setPadY, imageRadius, setImageRadius, paperMode, setPaperMode, paperColor, setPaperColor, paperTextureUrl, setPaperTextureUrl, paragraphGap, setParagraphGap, fontFamily, setFontFamily, fontColor, setFontColor, headingStyle, setHeadingStyle, headingIcon, setHeadingIcon, headingLabels, setHeadingLabels, headingPrefixes, setHeadingPrefixes, headingSeparators, setHeadingSeparators, headingNumberFormat, setHeadingNumberFormat } = useAppearanceState();
  const [recentStyles, setRecentStyles] = useState<string[]>([]);
  const [showAllStyles, setShowAllStyles] = useState(false);
  const headingLabelKey = `bar:${styles[style].id}`;
  const headingLabel = headingStyle === 'bar' ? headingLabels[headingLabelKey] ?? '' : '';
  const headingPrefix = headingPrefixes[styles[style].id] ?? '';
  const headingSeparator = headingSeparators[styles[style].id] ?? '';
  const setHeadingLabel = (value: string) => setHeadingLabels((current) => ({ ...current, [headingLabelKey]: value.slice(0, 12) }));
  const setHeadingPrefix = (value: string) => setHeadingPrefixes((current) => ({ ...current, [styles[style].id]: value.slice(0, 4) }));
  const setHeadingSeparator = (value: string) => setHeadingSeparators((current) => ({ ...current, [styles[style].id]: value.slice(0, 4) }));
  const [pixelLabel, setPixelLabel] = useState('');
  const [brandName, setBrandName] = useState('我的公众号风格');
  const [brandNote, setBrandNote] = useState('克制、清晰、有重点；跟随当前主题色与阅读参数。');
  const [savedStylePresets, setSavedStylePresets] = useState<SavedStylePreset[]>([]);
  const [activeSavedStyleId, setActiveSavedStyleId] = useState('');
  const [savedStylesReady, setSavedStylesReady] = useState(false);
  const [brandAvatarAssetId, setBrandAvatarAssetId] = useState('');
  const [brandQrAssetId, setBrandQrAssetId] = useState('');
  const [assets, setAssets] = useState<LocalAsset[]>([]);
  const [editorAction, setEditorAction] = useState<'link' | 'image' | 'caption' | null>(null);
  const [editorActionValue, setEditorActionValue] = useState('');
  const editorActionSelectionRef = useRef<{ from: number; to: number } | null>(null);
  const [planOptions, setPlanOptions] = useState<string[]>(['lead', 'divider', 'summary']);
  const [textBaseUrl, setTextBaseUrl] = useState('https://api.openai.com/v1');
  const [textApiKey, setTextApiKey] = useState('');
  const [unorderedMarker, setUnorderedMarker] = useState('disc');
  const [orderedMarker, setOrderedMarker] = useState('decimal');
  const [notice, setNotice] = useState('');
  const aiState = useAiState();
  const { aiPhase, setAiPhase, aiRecommendation, setAiRecommendation, aiSummary, setAiSummary, aiTitleOptions, setAiTitleOptions, aiSuggestions, setAiSuggestions, aiImageBriefs, setAiImageBriefs, aiImageCards, setAiImageCards, savedGeneratedImages, setSavedGeneratedImages, aiRevision, setAiRevision, revisionInstruction, setRevisionInstruction, aiResultMode, setAiResultMode } = aiState;
  useEffect(() => {
    // Successful AI application commits content and ready together; only pending work is reset.
    setAiPhase((phase) => phase === 'running' ? 'entry' : phase);
    setAiRevision(null);
    setAiImageCards((cards) => cards.some((card) => card.status === 'loading')
      ? cards.map((card) => card.status === 'loading' ? { ...card, status: 'error', error: '文章已变化，请重新生成配图。' } : card)
      : cards);
  }, [content]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [apiProvider, setApiProvider] = useState('本地模拟');
  const [apiModel, setApiModel] = useState('');
  const [apiProfiles, setApiProfiles] = useState<ApiProfile[]>([]);
  const [apiRoles, setApiRoles] = useState<ApiProfileRoles>({ textId: '', imageId: '' });
  const profileRevision = useRef(0);
  const applyApiProfiles = (profiles: ApiProfile[], roles: ApiProfileRoles) => {
    writeApiProfiles(profiles, roles);
    profileRevision.current += 1;
    setApiProfiles(profiles);
    setApiRoles(roles);
    const textProfile = profiles.find((item) => item.id === roles.textId);
    const textModel = textProfile?.modelConfigs.find((item) => item.id === roles.textModelId) || textProfile?.modelConfigs.find((item) => item.capabilities.includes('text'));
    setApiProvider(textProfile?.provider || '本地模拟');
    setApiModel(textModel?.modelId || textProfile?.models.text || '');
    setTextApiKey(textProfile?.apiKey || '');
    setTextBaseUrl(textProfile?.baseUrl || '');
  };
  const [drafts, setDrafts] = useState<ArticleRecord[]>([]);
  const [articlesReady, setArticlesReady] = useState(false);
  const [activeArticleId, setActiveArticleId] = useState('');
  const initialArticleId = useRef('');
  const requestScope = useRequestScope(activeArticleId, content);
  const articleSession = useRef(0);
  const renderArticleSession = articleSession.current;
  const invalidateArticleRequests = () => { articleSession.current += 1; requestScope.invalidate(); articleReview.reset(); setAiPhase('entry'); setAiRevision(null); setAiImageCards([]); };
  useEffect(() => { if (activeArticleId) rememberActiveArticle(activeArticleId); }, [activeArticleId]);
  const [documentJson, setDocumentJson] = useState<ArticleDocument | null>(null);
  const [htmlToImport, setHtmlToImport] = useState('');
  const [followTemplate, setFollowTemplate] = useState('minimal');
  const [followTitle, setFollowTitle] = useState('关注我们');
  const [followCopy, setFollowCopy] = useState('持续分享真正有用的内容');
  const [followCta, setFollowCta] = useState('关注公众号');
  const [followHref, setFollowHref] = useState('');
  const [followMedia, setFollowMedia] = useState('');
  const [historyTick, setHistoryTick] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const richEditorRef = useRef<Editor | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollLockRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const articleInputRef = useRef<HTMLInputElement>(null);
  const followMediaInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([sample]);
  const historyIndexRef = useRef(0);
  const restoringHistoryRef = useRef(false);
  const wordCount = useMemo(() => content.replace(/data:image\/[^\s)]+/g, '').replace(/\s/g, '').length, [content]);
  const codeCount = (content.match(/```/g)?.length || 0) / 2;
  const imageCount = (content.match(/^!\[[^\]]*\]\([^)]+\)$/gm) || []).length;
  const readMinutes = Math.max(1, Math.ceil(wordCount / 450));
  const styleDef = styles[style];
  // Resolve the paper the article HTML actually paints, then let markdownToWechat recompute ink from it.
  // follow → WeChat-white (pixelpost/boldneo/tech/knowledge keep style paper identity); style → style token; custom → picker.
  const resolvedPaper =
    paperMode === 'custom'
      ? paperColor
      : paperMode === 'style'
        ? styleDef.paper
        : styleDef.id === 'pixelpost' || styleDef.id === 'boldneo' || styleDef.id === 'tech' || styleDef.id === 'knowledge'
          ? styleDef.paper
          : '#ffffff';
  const editorHighlight = resolveArticleHighlight(styleDef.id, markerColor, '#ffffff', '#1b1b1b');
  const wechatReading = {
    fontSize,
    lineHeight,
    paragraphGap,
    padY,
    imageRadius,
    fontFamily,
    fontColor,
    headingStyle,
    headingIcon,
    headingLabel,
    headingPrefix,
    headingSeparator,
    headingNumberFormat,
    variant,
    paper: resolvedPaper,
    paperTextureUrl,
  };
  const wechatPreviewHtml = useMemo(() => markdownToWechat(content, accent, markerColor, styleDef.id, padX, pixelLabel, wechatReading), [content, accent, markerColor, styleDef.id, padX, pixelLabel, fontSize, lineHeight, paragraphGap, padY, imageRadius, fontFamily, fontColor, headingStyle, headingIcon, headingLabel, headingPrefix, headingSeparator, headingNumberFormat, variant, resolvedPaper, paperTextureUrl]);
  const sidebarStyles = useMemo(() => styles.map((item) => ({ id: item.id, name: item.name, grammar: item.grammar, accent: item.accent, paper: item.paper })), []);
  const syncScroll = useCallback((source: 'editor' | 'preview', event: React.UIEvent<HTMLElement>) => {
    if (scrollLockRef.current) return;
    const from = event.currentTarget;
    const to = source === 'editor' ? previewScrollRef.current : editorScrollRef.current;
    if (!to) return;
    const fromMax = from.scrollHeight - from.clientHeight;
    const toMax = to.scrollHeight - to.clientHeight;
    if (fromMax <= 0 || toMax <= 0) return;
    scrollLockRef.current = true;
    to.scrollTop = (from.scrollTop / fromMax) * toMax;
    window.requestAnimationFrame(() => { scrollLockRef.current = false; });
  }, []);
  const onEditorScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => syncScroll('editor', event), [syncScroll]);
  const onPreviewScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => syncScroll('preview', event), [syncScroll]);

  const say = (text: string) => { setNotice(text); window.setTimeout(() => setNotice(''), 1600); };
  const receiveEditorChange = useCallback((nextDocument: ArticleDocument, markdown: string) => {
    setDocumentJson(nextDocument);
    setContent(markdown);
  }, []);
  const receiveEditorReady = useCallback((editor: Editor | null) => {
    richEditorRef.current = editor;
  }, []);
  const openArticle = (article: ArticleRecord) => {
    flushArticle();
    invalidateArticleRequests();
    setActiveArticleId(article.id);
    rememberActiveArticle(article.id);
    setHtmlToImport('');
    setDocumentJson(article.content);
    const editor = richEditorRef.current;
    if (editor) {
      editor.commands.setContent(article.content, { emitUpdate: false });
      setContent(editor.getMarkdown());
    } else if (article.markdown) {
      setContent(article.markdown);
    } else {
      // Editor not ready yet; RichEditor document effect will call onChange and fill markdown.
      setContent('');
    }
    const nextStyle = styles.findIndex((item) => item.id === article.style);
    if (nextStyle >= 0) chooseStyle(nextStyle);
    const appearance = article.appearance;
    if (appearance) {
      setAccent(appearance.accent); setMarkerColor(appearance.markerColor); setVariant(appearance.variant);
      setFontSize(appearance.fontSize); setLineHeight(appearance.lineHeight); setPadX(appearance.padX); setPadY(appearance.padY); setImageRadius(appearance.imageRadius);
      if (typeof appearance.paragraphGap === 'number') setParagraphGap(appearance.paragraphGap);
      if (typeof appearance.fontFamily === 'string') setFontFamily(appearance.fontFamily);
      setFontColor(appearance.fontColor || '');
      setHeadingStyle(normalizeHeadingStyle(appearance.headingStyle)); setHeadingIcon(appearance.headingIcon || '◆'); setUnorderedMarker(appearance.unorderedMarker); setOrderedMarker(appearance.orderedMarker);
      setHeadingLabels(barLabels(appearance.headingLabels, normalizeHeadingStyle(appearance.headingStyle) === 'bar' ? appearance.headingLabel : '', article.style)); setHeadingPrefixes(barPrefixes(appearance.headingPrefixes)); setHeadingSeparators(barPrefixes(appearance.headingSeparators)); setHeadingNumberFormat(appearance.headingNumberFormat || '01');
      setPaperMode(appearance.paperMode || 'style'); setPaperColor(appearance.paperColor || '#ffffff'); setPaperTextureUrl(appearance.paperTextureUrl || '');
    }
    say(`已打开「${article.title}」`);
  };
  const loadMarkdown = (markdown: string) => {
    markdown = normalizeMarkdownTables(markdown);
    const editor = richEditorRef.current;
    if (editor) {
      editor.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false });
      receiveEditorChange(editor.getJSON() as ArticleDocument, editor.getMarkdown());
    }
    else { setDocumentJson(null); setContent(markdown); }
  };
  const createArticle = (markdown = '') => {
    flushArticle();
    invalidateArticleRequests();
    setActiveArticleId(crypto.randomUUID());
    rememberActiveArticle(null);
    setDocumentJson(null);
    setHtmlToImport('');
    loadMarkdown(markdown);
    say(markdown ? '已新建示例文稿' : '已新建空白文稿');
  };
  const chooseStyle = (index: number) => { const reading = styles[index].reading; setStyle(index); setPaperMode('style');
    const picked = styles[index]?.id;
    if (picked) {
      setRecentStyles((prev) => {
        const next = [picked, ...prev.filter((id) => id !== picked)].slice(0, 4);
        try { localStorage.setItem('kaipai.recentStyles', JSON.stringify(next)); } catch {}
        return next;
      });
      const skin = getStyleComponentDefaults(picked);
      setHeadingStyle(normalizeHeadingStyle(skin.headingStyle));
      setHeadingNumberFormat(skin.headingNumberFormat);
      setFollowTemplate(skin.follow);
      if (skin.follow === 'neo') {
        setFollowTitle('订阅下一篇内容');
        setFollowCopy('持续分享真正有用的内容');
        setFollowCta('FOLLOW');
      } else if (skin.follow === 'card') {
        setFollowTitle('持续更新');
        setFollowCopy('把有用的内容留给你');
        setFollowCta('关注公众号');
      } else if (skin.follow === 'brand') {
        setFollowTitle('关注我们');
        setFollowCopy('持续更新');
        setFollowCta('关注公众号');
      } else if (skin.follow === 'minimal') {
        // UI form defaults only — never rewrite existing :::divider / :::follow in content
        setFollowTitle('关注我们');
        setFollowCopy('持续分享真正有用的内容');
        setFollowCta('关注公众号');
      }
    } setFontFamily(styles[index].typography.fontFamily); setFontColor(''); setParagraphGap(reading.paragraphGap ?? 20); setAccent(styles[index].accent); setFontSize(reading.fontSize); setLineHeight(reading.lineHeight); setPadX(reading.padX); setPadY(reading.padY); setImageRadius(reading.imageRadius); say(`已应用 ${styles[index].name}`); };
  const { planError, pendingPlan, setPendingPlan, applyPlan, generateAiImage, runAiPlan, retryAiPlan, makeRevision, runAiTool, applyRevision } = useAiActions({
    state: aiState, content, articleId: activeArticleId, style, accent, apiProfiles, apiRoles, apiProvider, apiModel, textApiKey, textBaseUrl,
    assets, brandAvatarAssetId, brandQrAssetId, brandName, brandNote, requestScope,
    richEditorRef, chooseStyle, loadMarkdown, say, setApiOpen,
  });
  const reviewProfile = apiProfiles.find(item => item.id === apiRoles.textId);
  const reviewModel = reviewProfile?.modelConfigs.find(item => item.id === apiRoles.textModelId);
  const articleReview = useArticleReview({ content, articleId: activeArticleId, editorRef: richEditorRef, scope: requestScope,
    connection: apiProvider === '本地模拟' ? null : { provider: apiProvider as AiProviderId, apiKey: textApiKey, endpoint: textBaseUrl, model: apiModel || undefined,
      adapter: (reviewModel?.adapter || reviewProfile?.adapters.text) as 'openai-chat' | 'openai-responses' | undefined, prompt: '' },
    configure: () => setApiOpen(true), say,
  });

  // A proposal belongs to the current article revision, never to another draft.
  useEffect(() => { setPendingPlan(null); }, [activeArticleId, content]);
  const proposalPreview = useMemo(() => {
    if (!pendingPlan || pendingPlan.original !== content || aiPhase === 'running') return undefined;
    const selected = styles[pendingPlan.style];
    const skin = getStyleComponentDefaults(selected.id);
    return {
      styleId: selected.id,
      html: markdownToWechat(pendingPlan.markdown, selected.accent, markerColor, selected.id, selected.reading.padX, pixelLabel, {
        ...wechatReading, ...selected.reading, paragraphGap: selected.reading.paragraphGap ?? 20, fontFamily: selected.typography.fontFamily,
        fontColor: '', paper: selected.paper, headingStyle: normalizeHeadingStyle(skin.headingStyle), headingNumberFormat: skin.headingNumberFormat,
      }),
    };
  }, [pendingPlan, content, aiPhase, markerColor, pixelLabel, headingIcon, headingLabel, headingPrefix, headingSeparator, variant, paperTextureUrl]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('kaipai.recentStyles');
      if (raw) setRecentStyles(JSON.parse(raw).filter((id: string) => styles.some((s) => s.id === id)).slice(0, 4));
    } catch {}
  }, []);

  useEffect(() => {
    setAssets(listAssets());
    listGeneratedImages().then(setSavedGeneratedImages).catch(() => setSavedGeneratedImages([]));
    listArticles().then((articles) => {
      setDrafts(articles);
      const active = articles.find((article) => article.id === getActiveArticleId()) || articles[0];
      if (active && articleSession.current === 0) {
        setActiveArticleId(active.id);
        rememberActiveArticle(active.id);
        const styleIndex = Math.max(0, styles.findIndex((item) => item.id === active.style));
        setStyle(styleIndex);
        const appearance = active.appearance;
        if (appearance) {
          setAccent(appearance.accent); setMarkerColor(appearance.markerColor); setVariant(appearance.variant);
          setFontSize(appearance.fontSize); setLineHeight(appearance.lineHeight); setPadX(appearance.padX); setPadY(appearance.padY); setImageRadius(appearance.imageRadius);
          if (typeof appearance.paragraphGap === 'number') setParagraphGap(appearance.paragraphGap);
          if (typeof appearance.fontFamily === 'string') setFontFamily(appearance.fontFamily);
          setFontColor(appearance.fontColor || '');
          setHeadingStyle(normalizeHeadingStyle(appearance.headingStyle)); setHeadingIcon(appearance.headingIcon || '◆'); setUnorderedMarker(appearance.unorderedMarker); setOrderedMarker(appearance.orderedMarker);
          setHeadingLabels(barLabels(appearance.headingLabels, normalizeHeadingStyle(appearance.headingStyle) === 'bar' ? appearance.headingLabel : '', active.style)); setHeadingPrefixes(barPrefixes(appearance.headingPrefixes)); setHeadingSeparators(barPrefixes(appearance.headingSeparators)); setHeadingNumberFormat(appearance.headingNumberFormat || '01');
          setPaperMode(appearance.paperMode || 'style'); setPaperColor(appearance.paperColor || '#ffffff'); setPaperTextureUrl(appearance.paperTextureUrl || '');
        } else { setAccent(styles[styleIndex].accent); setFontColor(''); }
        setDocumentJson(active.content);
        setContent(active.markdown || '');
      }
    }).catch(() => setDrafts([])).finally(() => setArticlesReady(true));
    const savedStyle = Number(localStorage.getItem('kaipai.community.style'));
    if (Number.isInteger(savedStyle) && savedStyle >= 0 && savedStyle < styles.length) { setStyle(savedStyle); setAccent(styles[savedStyle].accent); }
    const savedAccent = localStorage.getItem('kaipai.community.accent');
    if (/^#[0-9a-f]{6}$/i.test(savedAccent || '')) setAccent(savedAccent!);
    const savedMarker = localStorage.getItem('kaipai.community.marker');
    if (/^#[0-9a-f]{6}$/i.test(savedMarker || '')) setMarkerColor(savedMarker!);
    const savedUi = localStorage.getItem('kaipai.community.ui');
    if (savedUi === 'neo2' || savedUi === 'tactile') setUi(savedUi);
    const savedVariant = localStorage.getItem('kaipai.community.variant');
    if (savedVariant === '克制' || savedVariant === '标准' || savedVariant === '视觉化') setVariant(savedVariant);
    const savedReading = localStorage.getItem('kaipai.community.reading');
    if (savedReading) { try { const reading = JSON.parse(savedReading); if (Number.isFinite(reading.fontSize)) setFontSize(reading.fontSize); if (Number.isFinite(reading.lineHeight)) setLineHeight(reading.lineHeight); if (Number.isFinite(reading.padX)) setPadX(reading.padX); if (Number.isFinite(reading.padY)) setPadY(reading.padY); if (Number.isFinite(reading.imageRadius)) setImageRadius(reading.imageRadius); if (Number.isFinite(reading.paragraphGap)) setParagraphGap(reading.paragraphGap); if (typeof reading.fontFamily === 'string' && reading.fontFamily) setFontFamily(reading.fontFamily); } catch { /* ignore malformed local data */ } }
    const savedHeading = localStorage.getItem('kaipai.community.heading');
    if (savedHeading) setHeadingStyle(normalizeHeadingStyle(savedHeading));
    const savedHeadingIcon = localStorage.getItem('kaipai.community.heading-icon');
    if (savedHeadingIcon !== null && savedHeadingIcon.length <= 4) setHeadingIcon(savedHeadingIcon || '◆');
    const savedHeadingLabel = localStorage.getItem('kaipai.community.heading-label');
    const savedHeadingLabels = localStorage.getItem('kaipai.community.heading-labels');
    if (savedHeadingLabels) { try { setHeadingLabels(barLabels(JSON.parse(savedHeadingLabels), savedHeadingLabel || '', styles[Number.isInteger(savedStyle) && savedStyle >= 0 && savedStyle < styles.length ? savedStyle : 0].id)); } catch { /* ignore malformed local data */ } }
    else if (savedHeadingLabel !== null) setHeadingLabels({ [`bar:${styles[Number.isInteger(savedStyle) && savedStyle >= 0 && savedStyle < styles.length ? savedStyle : 0].id}`]: savedHeadingLabel.slice(0, 12) });
    const savedHeadingPrefixes = localStorage.getItem('kaipai.community.heading-prefixes');
    if (savedHeadingPrefixes) { try { setHeadingPrefixes(barPrefixes(JSON.parse(savedHeadingPrefixes))); } catch { /* ignore malformed local data */ } }
    const savedHeadingSeparators = localStorage.getItem('kaipai.community.heading-separators');
    if (savedHeadingSeparators) { try { setHeadingSeparators(barPrefixes(JSON.parse(savedHeadingSeparators))); } catch { /* ignore malformed local data */ } }
    const savedHeadingNumberFormat = localStorage.getItem('kaipai.community.heading-number-format');
    if (savedHeadingNumberFormat === '01' || savedHeadingNumberFormat === '1' || savedHeadingNumberFormat === '一' || savedHeadingNumberFormat === 'none') setHeadingNumberFormat(savedHeadingNumberFormat);
    const savedEyebrow = localStorage.getItem('kaipai.community.eyebrow');
    if (savedEyebrow !== null) setPixelLabel(savedEyebrow);
    const savedBrand = localStorage.getItem('kaipai.community.brand');
    if (savedBrand) { try { const brand = JSON.parse(savedBrand); if (typeof brand.name === 'string') setBrandName(brand.name); if (typeof brand.note === 'string') setBrandNote(brand.note); if (typeof brand.avatarAssetId === 'string') setBrandAvatarAssetId(brand.avatarAssetId); if (typeof brand.qrAssetId === 'string') setBrandQrAssetId(brand.qrAssetId); } catch { localStorage.removeItem('kaipai.community.brand'); } }
    try {
      const rawPresets = JSON.parse(localStorage.getItem('kaipai.community.saved-styles') || '[]');
      if (Array.isArray(rawPresets)) setSavedStylePresets(rawPresets.filter((item): item is SavedStylePreset => Boolean(item && typeof item.id === 'string' && typeof item.name === 'string' && typeof item.styleId === 'string' && item.appearance && typeof item.appearance === 'object')).map((item) => ({ ...item, appearance: normalizedPresetAppearance(item.appearance, item.styleId) })));
      setActiveSavedStyleId(localStorage.getItem('kaipai.community.active-saved-style') || '');
    } catch { /* ignore malformed saved style data */ }
    setSavedStylesReady(true);
    const revision = ++profileRevision.current;
    void restoreApiProfiles().then(saved => {
      if (revision === profileRevision.current) applyApiProfiles(saved.profiles, saved.roles);
    }).catch(() => { if (revision === profileRevision.current) say('旧 API 配置未能安全恢复，请打开 AI 服务配置重新填写；原配置尚未删除。'); });
    const savedUnordered = localStorage.getItem('kaipai.community.unordered-marker');
    if (['disc', 'circle', 'square'].includes(savedUnordered || '')) setUnorderedMarker(savedUnordered!);
    const savedOrdered = localStorage.getItem('kaipai.community.ordered-marker');
    if (['decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'].includes(savedOrdered || '')) setOrderedMarker(savedOrdered!);
  }, []);
  useEffect(() => { localStorage.setItem('kaipai.community.style', String(style)); }, [style]);
  useEffect(() => { localStorage.setItem('kaipai.community.accent', accent); }, [accent]);
  useEffect(() => { localStorage.setItem('kaipai.community.marker', markerColor); }, [markerColor]);
  useEffect(() => { localStorage.setItem('kaipai.community.ui', ui); }, [ui]);
  useEffect(() => { localStorage.setItem('kaipai.community.variant', variant); }, [variant]);
  useEffect(() => { localStorage.setItem('kaipai.community.reading', JSON.stringify({ fontSize, lineHeight, padX, padY, imageRadius, paragraphGap, fontFamily })); }, [fontSize, lineHeight, padX, padY, imageRadius, paragraphGap, fontFamily]);
  useEffect(() => { localStorage.setItem('kaipai.community.heading', headingStyle); }, [headingStyle]);
  useEffect(() => { localStorage.setItem('kaipai.community.heading-icon', headingIcon); }, [headingIcon]);
  useEffect(() => { localStorage.setItem('kaipai.community.heading-label', headingLabel); }, [headingLabel]);
  useEffect(() => { localStorage.setItem('kaipai.community.heading-labels', JSON.stringify(headingLabels)); }, [headingLabels]);
  useEffect(() => { localStorage.setItem('kaipai.community.heading-prefixes', JSON.stringify(headingPrefixes)); }, [headingPrefixes]);
  useEffect(() => { localStorage.setItem('kaipai.community.heading-separators', JSON.stringify(headingSeparators)); }, [headingSeparators]);
  useEffect(() => { localStorage.setItem('kaipai.community.heading-number-format', headingNumberFormat); }, [headingNumberFormat]);
  useEffect(() => { localStorage.setItem('kaipai.community.eyebrow', pixelLabel); }, [pixelLabel]);
  useEffect(() => { localStorage.setItem('kaipai.community.brand', JSON.stringify({ name: brandName, note: brandNote, avatarAssetId: brandAvatarAssetId, qrAssetId: brandQrAssetId })); }, [brandName, brandNote, brandAvatarAssetId, brandQrAssetId]);
  useEffect(() => { if (savedStylesReady) localStorage.setItem('kaipai.community.saved-styles', JSON.stringify(savedStylePresets)); }, [savedStylesReady, savedStylePresets]);
  useEffect(() => { if (savedStylesReady) localStorage.setItem('kaipai.community.active-saved-style', activeSavedStyleId); }, [savedStylesReady, activeSavedStyleId]);
  useEffect(() => { localStorage.setItem('kaipai.community.unordered-marker', unorderedMarker); }, [unorderedMarker]);
  useEffect(() => { localStorage.setItem('kaipai.community.ordered-marker', orderedMarker); }, [orderedMarker]);
  useEffect(() => {
    if (restoringHistoryRef.current) { restoringHistoryRef.current = false; return; }
    const history = historyRef.current;
    const index = historyIndexRef.current;
    if (history[index] === content) return;
    const next = [...history.slice(0, index + 1), content].slice(-40);
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setHistoryTick((value) => value + 1);
  }, [content]);
  const autosaveArticle = useMemo<ArticleRecord | null>(() => {
    if (!articlesReady || !documentJson) return null;
    if (!initialArticleId.current) initialArticleId.current = crypto.randomUUID();
    const now = Date.now();
    const existing = drafts.find((item) => item.id === activeArticleId);
    return {
        id: activeArticleId || initialArticleId.current,
        title: content.split('\n').find(Boolean)?.replace(/^#+\s*/, '') || '未命名文稿',
        content: documentJson,
        markdown: content,
        style: styleDef.id,
        appearance: { accent, markerColor, variant, fontSize, lineHeight, padX, padY, imageRadius, paragraphGap, fontFamily, fontColor, headingStyle, headingIcon, headingLabel, headingLabels, headingPrefixes, headingSeparators, headingNumberFormat, paperMode, paperColor, paperTextureUrl, unorderedMarker, orderedMarker },
        createdAt: existing?.createdAt || now,
        updatedAt: now,
    };
  }, [articlesReady, content, documentJson, activeArticleId, styleDef.id, accent, markerColor, variant, fontSize, lineHeight, padX, padY, imageRadius, paragraphGap, fontFamily, fontColor, headingStyle, headingIcon, headingLabel, headingLabels, headingPrefixes, headingSeparators, headingNumberFormat, paperMode, paperColor, paperTextureUrl, unorderedMarker, orderedMarker]);
  const { flush: flushArticle, remove: removeArticle } = useArticleAutosave(autosaveArticle, (article) => {
    setActiveArticleId((current) => current || article.id);
    setDrafts((items) => {
      const current = items.find((item) => item.id === article.id);
      if (current && current.updatedAt > article.updatedAt) return items;
      return [article, ...items.filter((item) => item.id !== article.id)].sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, () => say('文稿保存失败，请检查浏览器存储空间'));

  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const isCurrent = requestScope.begin('import');
    try {
      if (/\.docx$/i.test(file.name)) {
        const html = await importDocx(file);
        if (!isCurrent()) return;
        flushArticle();
        invalidateArticleRequests();
        setActiveArticleId(crypto.randomUUID());
        setDocumentJson(null);
        setContent('');
        setHtmlToImport(html);
      } else {
        const raw = await file.text();
        if (!isCurrent()) return;
        const next = /\.html?$/i.test(file.name) ? new DOMParser().parseFromString(raw, 'text/html').body.innerText : raw;
        flushArticle();
        invalidateArticleRequests();
        setActiveArticleId(crypto.randomUUID());
        setDocumentJson(null);
        setHtmlToImport('');
        loadMarkdown(next);
      }
      say(`已导入 ${file.name}`);
    } catch (error) {
      say(error instanceof Error ? error.message : '导入失败，请换一份文稿后重试');
    } finally {
      input.value = '';
    }
  };
  const insertImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0]; if (!file) return;
    const isCurrent = requestScope.begin('insert-image');
    const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    input.value = '';
    if (!isCurrent()) return;
    const alt = file.name.replace(/\.[^.]+$/, '') || '文章配图';
    if (richEditorRef.current) richEditorRef.current.chain().focus().setImage({ src, alt }).run();
    else apply(`![${alt}](${src})`);
    input.value = '';
  };
  const openEditorAction = (action: 'link' | 'image' | 'caption') => {
    const editor = richEditorRef.current;
    editorActionSelectionRef.current = editor ? { from: editor.state.selection.from, to: editor.state.selection.to } : null;
    setEditorActionValue(action === 'caption' && editor?.isActive('image') ? String(editor.getAttributes('image').alt || '') : '');
    setEditorAction(action);
  };
  const submitEditorAction = () => {
    const value = editorActionValue.trim();
    const action = editorAction;
    const editor = richEditorRef.current;
    const selection = editorActionSelectionRef.current;
    if (!action || (!value && action !== 'caption')) return;
    if (editor && selection) editor.commands.setTextSelection(selection);
    if (action === 'image') {
      const src = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      if (editor) editor.chain().focus().setImage({ src, alt: '文章配图' }).run();
      else apply(`![文章配图](${src})`);
    } else if (action === 'caption') {
      if (editor?.isActive('image')) editor.chain().focus().updateAttributes('image', { alt: value }).run();
      else { say('先点选编辑区里的图片'); return; }
    } else {
      const href = /^(https?:|mailto:)/i.test(value) ? value : `https://${value}`;
      if (editor) {
        if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: 'text', text: '链接文字', marks: [{ type: 'link', attrs: { href } }] }).run();
        else editor.chain().focus().setLink({ href }).run();
      } else apply(`[链接文字](${href})`);
    }
    setEditorAction(null);
    setEditorActionValue('');
    say(action === 'image' ? '已插入图片' : action === 'caption' ? '图片说明已更新' : '已添加链接');
  };
  const editImageCaption = () => {
    if (!richEditorRef.current?.isActive('image')) { say('先点选编辑区里的图片'); return; }
    openEditorAction('caption');
  };
  const apply = (text: string) => {
    const localVisual = '![文章配图](data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221080%22 height=%22680%22 viewBox=%220 0 1080 680%22%3E%3Crect width=%221080%22 height=%22680%22 fill=%22%23f0f5f2%22/%3E%3Cpath d=%22M0 520C160 410 290 580 470 465S775 350 1080 470V680H0Z%22 fill=%22%23b9e6d7%22/%3E%3Crect x=%2272%22 y=%2270%22 width=%22936%22 height=%22540%22 rx=%2224%22 fill=%22%23ffffff%22 stroke=%22%231a8065%22 stroke-width=%224%22/%3E%3Ctext x=%22122%22 y=%22220%22 fill=%22%231a8065%22 font-size=%2232%22 font-family=%22Arial%22 font-weight=%22700%22%3EKAIPAI / LOCAL VISUAL%3C/text%3E%3Ctext x=%22122%22 y=%22304%22 fill=%22%23243833%22 font-size=%2256%22 font-family=%22Arial%22 font-weight=%22700%22%3E让内容更好读%3C/text%3E%3Cpath d=%22M122 370H720M122 410H612%22 stroke=%22%2395b6aa%22 stroke-width=%2216%22 stroke-linecap=%22round%22/%3E%3Ccircle cx=%22848%22 cy=%22396%22 r=%2288%22 fill=%22%23d8f4ea%22 stroke=%22%231a8065%22 stroke-width=%224%22/%3E%3Cpath d=%22M804 396h88M848 352v88%22 stroke=%22%231a8065%22 stroke-width=%2212%22/%3E%3C/svg%3E)';
    // Keep pipe-formatted :::follow as authored (title/copy/cta/media/href).
    // Only rewrite legacy snippets without pipes / old callout aliases.
    const trimmed = text.trim();
    const alreadyFollow = /^:::follow\s*\n[^\n|]+\|/.test(trimmed);
    const followTemplate = alreadyFollow
      ? ''
      : text.includes('＋ FOLLOW')
        ? 'neo'
        : text.includes('扫码关注')
          ? 'qr'
          : text.includes('作者｜')
            ? 'avatar'
            : text.includes('继续阅读')
              ? 'split'
              : text.includes('楷排编辑部｜')
                ? 'account'
                : text.includes('持续更新｜')
                  ? 'card'
                  : text.includes('关注我们｜')
                    ? 'brand'
                    : text.startsWith(':::follow') && !text.includes('|')
                      ? 'minimal'
                      : '';
    const followContent: Record<string, [string, string, string]> = {
      minimal: ['关注我们', '持续分享真正有用的内容', '关注公众号'],
      brand: ['关注我们', '持续更新', '关注公众号'],
      card: ['持续更新', '把有用的内容留给你', '关注公众号'],
      neo: ['订阅下一篇内容', '持续分享真正有用的内容', '关注公众号'],
      qr: ['扫码关注', '获取完整内容与更新', '关注公众号'],
      avatar: ['作者｜楷排编辑部', '持续分享真正有用的内容', '关注公众号'],
      split: ['继续阅读', '获取下一篇文章', '关注公众号'],
      account: ['楷排编辑部', '持续分享真正有用的内容', '关注公众号'],
    };
    const normalized = text.includes('images.unsplash.com')
      ? localVisual
      : text.startsWith(':::callout\n导语：')
        ? text.replace(':::callout', ':::lead')
        : text.startsWith(':::callout\n作者｜')
          ? text.replace(':::callout', ':::author')
          : followTemplate
            ? `:::follow\n${followTemplate}|${followContent[followTemplate].join('|')}||\n:::`
            : text;
    if (richEditorRef.current) {
      const editor = richEditorRef.current;
      // TipTap markdown can mangle :::fences (pipe lines → tables), leaving lone ":::" in the doc.
      // Insert community components as structured nodes / HTML instead.
      const fence = normalized.trim().match(/^:::(lead|tip|warn|follow|recs|recommendations|author|divider|callout)\s*\n([\s\S]*?)\n:::$/);
      if (fence) {
        const kind = fence[1] === 'recommendations' ? 'recs' : fence[1] === 'callout' ? 'tip' : fence[1];
        const body = fence[2];
        const paragraphs = body.split(/\r?\n/).filter((line) => line.length > 0).map((line) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: line }],
        }));
        const nodes = [
          {
            type: 'communityBlock',
            attrs: { kind },
            content: paragraphs.length ? paragraphs : [{ type: 'paragraph' }],
          },
          { type: 'paragraph' },
        ];
        // Insert at the saved editor selection. Sidebar clicks do not move TipTap's
        // selection; if it is inside a component, place the new block after it.
        const { $from } = editor.state.selection;
        let insertPos = editor.state.selection.from;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          if ($from.node(depth).type.name === 'communityBlock') {
            insertPos = $from.after(depth);
            break;
          }
        }
        editor.chain().focus().insertContentAt(insertPos, nodes).run();
      } else {
        editor.commands.insertContent(normalized, { contentType: 'markdown' });
      }
      editor.commands.focus();
      say('组件已插入编辑区');
      return;
    }
    const field = editorRef.current;
    if (!field) { setContent((value) => `${value}\n\n${normalized}`); say('组件已插入编辑区'); return; }
    const start = field.selectionStart; const end = field.selectionEnd;
    const before = content.slice(0, start); const after = content.slice(end);
    const prefix = before && !before.endsWith('\n\n') ? '\n\n' : '';
    const suffix = after && !after.startsWith('\n\n') ? '\n\n' : '';
    const next = `${before}${prefix}${normalized}${suffix}${after}`;
    const focusAt = start + prefix.length + normalized.length;
    setContent(next);
    window.setTimeout(() => { field.focus(); field.setSelectionRange(focusAt, focusAt); }, 0);
    say('组件已插入编辑区');
  };
  const format = (before: string, after = before, fallback = '文本') => {
    const richEditor = richEditorRef.current;
    if (richEditor) {
      if (before === '`' && richEditor.state.selection.empty) {
        richEditor.chain().focus().insertContent({ type: 'text', text: fallback, marks: [{ type: 'code' }] }).run();
        say('已插入行内代码，可直接编辑文字');
        return;
      }
      const command = before === '**' ? richEditor.chain().focus().toggleBold() : before === '*' ? richEditor.chain().focus().toggleItalic() : before === '~~' ? richEditor.chain().focus().toggleStrike() : before === '==' ? richEditor.chain().focus().toggleHighlight() : before === '`' ? richEditor.chain().focus().toggleCode() : null;
      if (command) { command.run(); return; }
      if (before === '# ') { richEditor.chain().focus().setHeading({ level: 1 }).run(); return; }
      if (before === '') { richEditor.chain().focus().setParagraph().run(); return; }
      if (before === '## ') { richEditor.chain().focus().toggleHeading({ level: 2 }).run(); return; }
      if (before === '### ') { richEditor.chain().focus().toggleHeading({ level: 3 }).run(); return; }
      if (before === '> ') { richEditor.chain().focus().toggleBlockquote().run(); return; }
      if (before === '- ') { richEditor.chain().focus().toggleBulletList().run(); return; }
      if (before === '1. ') { richEditor.chain().focus().toggleOrderedList().run(); return; }
      if (before.startsWith('```')) { richEditor.chain().focus().toggleCodeBlock().run(); return; }
    }
    const field = editorRef.current; if (!field) return;
    const start = field.selectionStart; const end = field.selectionEnd; const selected = content.slice(start, end) || fallback;
    setContent(`${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`);
    window.setTimeout(() => { field.focus(); field.setSelectionRange(start + before.length, start + before.length + selected.length); }, 0);
  };
  const clearFormat = () => {
    if (richEditorRef.current) {
      if (richEditorRef.current.state.selection.empty) { say('请先选中要清除格式的文字'); return; }
      richEditorRef.current.chain().focus().unsetAllMarks().clearNodes().run(); say('已清除选中文字的格式'); return;
    }
    const field = editorRef.current; if (!field) return;
    const start = field.selectionStart; const end = field.selectionEnd; const selected = content.slice(start, end);
    if (!selected) { say('请先选中要清除格式的文字'); return; }
    const plain = selected.replace(/^#{1,3}\s+/gm, '').replace(/^>\s?/gm, '').replace(/^[-*+]\s+/gm, '').replace(/^\d+\.\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/~~(.*?)~~/g, '$1').replace(/==(.*?)==/g, '$1').replace(/`(.*?)`/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    setContent(`${content.slice(0, start)}${plain}${content.slice(end)}`);
    window.setTimeout(() => { field.focus(); field.setSelectionRange(start, start + plain.length); }, 0); say('已清除选中文字的格式');
  };
  const insertLink = () => {
    openEditorAction('link');
  };
  const insertTable = () => {
    if (richEditorRef.current) {
      richEditorRef.current.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run();
      say('已插入表格');
      return;
    }
    apply('| 元素 | 作用 |\n| --- | --- |\n| 标题 | 切开章节 |');
  };
  const undoEditor = (direction: -1 | 1) => {
    const editor = richEditorRef.current;
    if (editor) {
      const changed = direction < 0 ? editor.chain().focus().undo().run() : editor.chain().focus().redo().run();
      if (!changed) say(direction < 0 ? '已经是最早的编辑状态' : '已经是最新的编辑状态');
      return;
    }
    restoreHistory(direction);
  };
  const tidyDocument = () => {
    const tidy = content.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
    if (richEditorRef.current) richEditorRef.current.commands.setContent(tidy, { contentType: 'markdown' });
    else setContent(tidy);
    say('已整理空行');
  };
  const chooseFollowTemplate = (id: string, title: string, copy: string, cta: string) => {
    const defaultAssetId = id === 'qr' ? brandQrAssetId : id === 'avatar' ? brandAvatarAssetId : '';
    const defaultAsset = assets.find((asset) => asset.id === defaultAssetId);
    setFollowTemplate(id); setFollowTitle(title); setFollowCopy(copy); setFollowCta(cta);
    if (defaultAsset) setFollowMedia(defaultAsset.url);
    say(defaultAsset ? `已选择模板并带入「${defaultAsset.name}」` : `已选择「${id === 'minimal' ? '极简' : id === 'brand' ? '品牌色' : id === 'card' ? '轻卡片' : id === 'neo' ? '粗犷' : id === 'qr' ? '二维码型' : id === 'avatar' ? '作者头像型' : id === 'split' ? '左图右文型' : '公众号名片型'}」模板`);
  };
  const readFollowMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0]; if (!file) return;
    const isCurrent = requestScope.begin('follow-media');
    const source = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    input.value = '';
    if (!isCurrent()) return;
    setFollowMedia(source); say('已载入关注组件图片');
  };
  const insertFollow = () => {
    const safe = (value: string) => value.replace(/\|/g, '／').replace(/\n/g, ' ');
    const defaultAssetId = followTemplate === 'qr' ? brandQrAssetId : followTemplate === 'avatar' ? brandAvatarAssetId : '';
    const source = followMedia || assets.find((asset) => asset.id === defaultAssetId)?.url || '';
    apply(`:::follow\n${safe(followTemplate)}|${safe(followTitle)}|${safe(followCopy)}|${safe(followCta)}|${safe(source)}|${safe(followHref)}\n:::`);
  };
  const restoreHistory = (direction: -1 | 1) => {
    const nextIndex = historyIndexRef.current + direction;
    if (nextIndex < 0 || nextIndex >= historyRef.current.length) { say(direction < 0 ? '已经是最早的编辑状态' : '已经是最新的编辑状态'); return; }
    historyIndexRef.current = nextIndex;
    restoringHistoryRef.current = true;
    loadMarkdown(historyRef.current[nextIndex]);
    setHistoryTick((value) => value + 1);
    say(direction < 0 ? '已撤销上一步编辑' : '已恢复下一步编辑');
  };
  const canUndo = richEditorRef.current?.can().undo() ?? (historyTick >= 0 && historyIndexRef.current > 0);
  const canRedo = richEditorRef.current?.can().redo() ?? (historyTick >= 0 && historyIndexRef.current < historyRef.current.length - 1);
  /** Put the exact HTML string on the clipboard (WeChat-classic). Do NOT serialize from a live DOM holder. */
  const copyExactHtml = (exactHtml: string, plain: string): boolean => {
    let ok = false;
    let wrote = false;
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      if (!e.clipboardData) return;
      e.clipboardData.setData('text/html', exactHtml);
      e.clipboardData.setData('text/plain', plain);
      ok = true;
    };
    document.addEventListener('copy', onCopy);
    try {
      // Need a selectable node for execCommand to fire 'copy' in some browsers
      const probe = document.createElement('div');
      probe.textContent = '楷';
      probe.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(probe);
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(probe);
      sel?.removeAllRanges();
      sel?.addRange(range);
      wrote = document.execCommand('copy');
      sel?.removeAllRanges();
      probe.remove();
    } finally {
      document.removeEventListener('copy', onCopy);
    }
    return ok && wrote;
  };
  const copy = async () => {
    const rawHtml = markdownToWechat(content, accent, markerColor, styleDef.id, padX, pixelLabel, wechatReading);
    const gated = enforceWechatCompliance(rawHtml);
    if (!gated.ok) {
      const v = gated.violations[0];
      const where = v?.index ? `第${v.index}段` : '未知段';
      const why = v?.message || v?.reason || '行高异常';
      say(`公众号合规未通过：${where} ${why}（未复制）`);
      return;
    }
    const publication = prepareWechatPublication(gated.html);
    const html = publication.html;
    const plain = htmlToPlainText(html);
    const copied = () => say(publication.images.length
      ? '正文已复制；待上传位置已标出，请下载图片并在公众号后台上传'
      : '正文已复制，请在微信后台保存并预览检查');
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error('rich clipboard unavailable');
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })]);
      copied();
    } catch {
      if (copyExactHtml(html, plain)) { copied(); return; }
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(plain);
        say('已复制纯文本；当前浏览器未支持富文本剪贴板');
      } catch {
        say('浏览器未授权剪贴板，请重试复制');
      }
    }
  };
  const downloadArticleImages = async () => {
    const html = markdownToWechat(content, accent, markerColor, styleDef.id, padX, pixelLabel, wechatReading);
    const images = prepareWechatPublication(html).images;
    if (!images.length) { say('没有需要上传的图片'); return; }
    say('正在准备图片下载包…');
    try {
      const result = await createArticleImagePackage(images);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '公众号正文图片.zip';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      say(result.failed ? `已下载 ${result.count} 张图片；${result.failed} 张失败，详见包内说明` : `已下载 ${result.count} 张图片与图注，请按编号在公众号后台上传`);
    } catch (error) {
      say(error instanceof Error ? error.message : '图片下载失败，请重试');
    }
  };
  const copyImageBriefs = async () => {
    const text = aiImageBriefs.map((brief, index) => `${index + 1}. ${brief}`).join('\n');
    if (!text) { say('请先生成配图建议'); return; }
    try { await navigator.clipboard.writeText(text); say('已复制配图方向'); } catch { say('浏览器未授权剪贴板，请手动复制'); }
  };
  const download = (filename: string, body: string, type: string) => {
    const link = document.createElement('a');
    const url = URL.createObjectURL(new Blob([body], { type }));
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Give the browser time to consume the URL before releasing its contents.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(`已导出 ${filename}`);
  };
  const exportWechatHtml = () => {
    const title = content.split('\n').find(Boolean)?.replace(/^#+\s*/, '') || '楷排文章';
    const html = markdownToWechat(content, accent, markerColor, styleDef.id, padX, pixelLabel, wechatReading);
    download(`${title}.html`, makeStandaloneHtml(html, title), 'text/html;charset=utf-8');
    const notice = wechatResourceNotice(html);
    if (notice) say(`HTML 已导出；${notice}`);
  };
  const currentStyleAppearance: NonNullable<ArticleRecord['appearance']> = {
    accent, markerColor, variant, fontSize, lineHeight, padX, padY, imageRadius,
    paragraphGap, fontFamily, fontColor, headingStyle, headingIcon,
    headingLabel, headingLabels, headingPrefixes, headingSeparators, headingNumberFormat, paperMode, paperColor, paperTextureUrl, unorderedMarker, orderedMarker,
  };
  const activeSavedStyle = savedStylePresets.find((item) => item.id === activeSavedStyleId);
  const savedStyleDirty = Boolean(activeSavedStyle && (activeSavedStyle.styleId !== styleDef.id || JSON.stringify(activeSavedStyle.appearance) !== JSON.stringify(currentStyleAppearance)));
  const saveStylePreset = (name: string, note: string) => {
    const preset: SavedStylePreset = { id: crypto.randomUUID(), name: name.slice(0, 40), note: note.slice(0, 180), styleId: styleDef.id, appearance: { ...currentStyleAppearance, headingLabels: { ...headingLabels }, headingPrefixes: { ...headingPrefixes }, headingSeparators: { ...headingSeparators } }, updatedAt: Date.now() };
    setSavedStylePresets((items) => [preset, ...items]);
    setActiveSavedStyleId(preset.id);
    setBrandName(preset.name); setBrandNote(preset.note);
    say(`已保存「${preset.name}」`);
  };
  const applyStylePreset = (id: string) => {
    const preset = savedStylePresets.find((item) => item.id === id);
    if (!preset) return;
    const index = styles.findIndex((item) => item.id === preset.styleId);
    if (index < 0) { say('这套风格对应的基础样式已不存在'); return; }
    const a = preset.appearance;
    setStyle(index); setAccent(a.accent); setMarkerColor(a.markerColor); setVariant(a.variant);
    setFontSize(a.fontSize); setLineHeight(a.lineHeight); setPadX(a.padX); setPadY(a.padY); setImageRadius(a.imageRadius);
    setParagraphGap(a.paragraphGap ?? 16); setFontFamily(a.fontFamily || '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif'); setFontColor(a.fontColor || '');
    setHeadingStyle(normalizeHeadingStyle(a.headingStyle)); setHeadingIcon(a.headingIcon || '◆');
    setHeadingLabels({ ...(a.headingLabels || {}) }); setHeadingPrefixes({ ...(a.headingPrefixes || {}) }); setHeadingSeparators({ ...(a.headingSeparators || {}) }); setHeadingNumberFormat(a.headingNumberFormat || '01'); setPaperMode(a.paperMode || 'style'); setPaperColor(a.paperColor || '#ffffff'); setPaperTextureUrl(a.paperTextureUrl || '');
    setUnorderedMarker(a.unorderedMarker); setOrderedMarker(a.orderedMarker);
    setActiveSavedStyleId(id); setBrandName(preset.name); setBrandNote(preset.note);
    say(`已应用「${preset.name}」`);
  };
  const updateStylePreset = (id: string) => {
    const preset = savedStylePresets.find((item) => item.id === id);
    if (!preset) return;
    setSavedStylePresets((items) => items.map((item) => item.id === id ? { ...item, styleId: styleDef.id, appearance: { ...currentStyleAppearance, headingLabels: { ...headingLabels }, headingPrefixes: { ...headingPrefixes }, headingSeparators: { ...headingSeparators } }, updatedAt: Date.now() } : item));
    say(`已更新「${preset.name}」`);
  };
  const deleteStylePreset = (id: string) => {
    const preset = savedStylePresets.find((item) => item.id === id);
    if (!preset) return;
    setSavedStylePresets((items) => items.filter((item) => item.id !== id));
    if (activeSavedStyleId === id) setActiveSavedStyleId('');
    say(`已删除「${preset.name}」`);
  };
  // Preview, clipboard and file export use the same renderer and options.

  return <main id="kaipai-studio" className={`v091-app kaipai-studio v091-${ui} v091-mobile-${mobileView}`} data-ui={ui === "tactile" ? "tactile" : "neo2"}>
    <header className="v091-topbar">
      <div className="v091-brand"><b>楷</b><span><strong>楷排 <i>v0.91</i></strong><small>AI PUBLISHING WORKSPACE</small></span></div>
      <button className={`v091-top-chip v091-api-status ${apiProvider !== '本地模拟' && textApiKey ? 'connected' : 'disconnected'}`} onClick={() => setApiOpen(true)}><span className="v091-api-indicator" aria-hidden="true" />API {apiProvider === '本地模拟' ? '本地模拟' : textApiKey ? '已配置' : '未配置'}</button>
      <div className="v091-top-actions"><label className="v091-btn">↥ 导入<input ref={articleInputRef} type="file" accept=".md,.markdown,.txt,.html,.htm,.docx" onChange={importFile} /></label><button className="v091-btn studio-copy" disabled={tab === 'ai' && Boolean(proposalPreview)} title={tab === 'ai' && proposalPreview ? '请先应用排版或保留原文' : undefined} onClick={copy}>⧉ 复制公众号</button><button className="v091-btn" onClick={downloadArticleImages}>↓ 下载图片</button><button className="v091-btn" disabled={tab === 'ai' && Boolean(proposalPreview)} onClick={exportWechatHtml}>↓ 导出 HTML</button><button className="v091-btn" onClick={() => download(`${content.split('\n').find(Boolean)?.replace(/^#+\s*/, '') || '楷排文章'}.md`, content, 'text/markdown;charset=utf-8')}>↓ 导出 Markdown</button><button className="v091-top-help" aria-label="使用帮助" onClick={() => setHelpOpen(true)}>?</button></div>
    </header>
    <nav className="v091-mobile-switch" aria-label="移动端面板切换">
      {([{ id: 'styles', text: '样式' }, { id: 'edit', text: '编辑' }, { id: 'preview', text: '预览' }] as const).map((item) => (
        <button
          key={item.id}
          type="button"
          className={mobileView === item.id ? 'active' : ''}
          aria-pressed={mobileView === item.id}
          onClick={() => setMobileView(item.id)}
        >{item.text}</button>
      ))}
    </nav>
    <section className="v091-workspace workspace">
      <V091Sidebar
        coverContext={{ article: content, articleId: activeArticleId, profiles: apiProfiles, roles: apiRoles, savedImages: savedGeneratedImages, configure: () => setApiOpen(true), onSaved: image => setSavedGeneratedImages(items => [image, ...items.filter(item => item.id !== image.id)].slice(0, 12)) }}
        tab={tab === 'components' ? 'styles' : tab}
        onTabChange={(next) => setTab(next === 'styles' ? 'components' : next)}
        styles={sidebarStyles}
        styleId={styleDef.id}
        styleName={styleDef.name}
        styleGrammar={styleDef.grammar}
        variant={({ '克制': 'quiet', '标准': 'standard', '视觉化': 'visual' } as const)[variant] || 'standard'}
        accent={accent}
        fontColor={fontColor}
        markerColor={markerColor}
        resolvedPaper={resolvedPaper}
        onFontColorChange={setFontColor}
        onVariantChange={(next) => setVariant(({ quiet: '克制', standard: '标准', visual: '视觉化' } as const)[next])}
        onAccentChange={setAccent}
        onStyleChange={(id) => {
          const index = styles.findIndex((item) => item.id === id);
          if (index >= 0) chooseStyle(index);
        }}
        onInsertMarkdown={(md) => { if (renderArticleSession === articleSession.current) apply(md); }}
        onPatchContent={(fn) => {
          if (renderArticleSession !== articleSession.current) return;
          const editor = richEditorRef.current;
          const prev = editor && typeof editor.getMarkdown === 'function' ? editor.getMarkdown() : content;
          const next = fn(prev);
          if (next === prev) return;
          if (editor) editor.commands.setContent(next, { contentType: 'markdown' });
          else setContent(next);
        }}
        onHighlightColorChange={(color) => setMarkerColor(color)}
        onApplyHighlight={(color) => {
          setMarkerColor(color);
          const editor = richEditorRef.current;
          if (editor) {
            const { empty } = editor.state.selection;
            if (empty) {
              editor.chain().focus().insertContent('荧光重点').run();
              // Select inserted placeholder then apply TipTap Highlight mark
              const { from } = editor.state.selection;
              const start = Math.max(1, from - '荧光重点'.length);
              editor.chain().focus().setTextSelection({ from: start, to: from }).toggleHighlight().run();
              say('已插入重点占位，直接输入文字即可');
            } else {
              editor.chain().focus().toggleHighlight().run();
              say('已应用荧光重点');
            }
            return;
          }
          format('==', '==', '荧光重点');
        }}
        drafts={drafts.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt }))}
        onOpenDraft={(id) => {
          const draft = drafts.find((item) => item.id === id);
          if (draft) openArticle(draft);
        }}
        onCreateDraft={() => createArticle()}
        onLoadSample={() => createArticle(sample)}
        onImportDraft={() => articleInputRef.current?.click()}
        onDeleteDraft={(id) => {
          removeArticle(id).then(() => setDrafts((items) => items.filter((item) => item.id !== id))).catch(() => say('删除失败，请重试'));
          if (activeArticleId === id) createArticle();
        }}
        onSay={say}
        onRunAiPlan={(options) => runAiPlan('layout', options)}
        onPlanAiImages={(scope, instruction) => runAiPlan('images', { imageScope: scope, imageInstruction: instruction })}
        onRunAiTool={runAiTool}
        onApplyAiPlan={() => applyPlan()}
        aiHasPendingPlan={Boolean(proposalPreview)}
        onDiscardAiPlan={() => { setPendingPlan(null); setAiPhase('entry'); say('已保留原文'); }}
        onRetryAiPlan={retryAiPlan}
        onPlanStyleChange={(id) => { const index = styles.findIndex(item => item.id === id); if (index >= 0) { setPendingPlan(plan => plan ? { ...plan, style: index } : plan); setAiRecommendation(index); } }}
        onCopyArticle={copy}
        onDownloadImages={downloadArticleImages}
        onCancelAiPlan={() => { requestScope.cancel('plan'); setAiPhase('entry'); }}
        aiPlanError={planError}
        aiSummary={aiSummary}
        aiSuggestions={aiSuggestions}
        aiImageBriefs={aiImageBriefs}
        aiImageCards={aiImageCards}
        aiSavedImages={savedGeneratedImages}
        onPreviewSavedImage={(id) => { const image = savedGeneratedImages.find((item) => item.id === id); if (image) { setAiImageCards([{ id: crypto.randomUUID(), brief: image.brief, prompt: image.prompt, src: image.src, status: 'done' }]); say('已打开配图预览，确认图注后可插入文章'); } }}
        onGenerateAiImage={(id, prompt, ratios, visualStyle, imageText) => {
          const isCurrent = requestScope.begin(`image-batch:${id}`);
          const card = aiImageCards.find(item => item.id === id);
          if (!card) return;
          const basePrompt = prompt || card.prompt;
          const variants = ratios.map(ratio => ({ ...card, prompt: basePrompt, ratio, visualStyle, imageText, id: crypto.randomUUID(), src: '', status: 'idle' as const, error: '' }));
          setAiImageCards(items => items.flatMap(item => item.id === id ? variants : [item]));
          void (async () => {
            for (let i = 0; i < variants.length; i++) {
              if (!isCurrent()) return;
              await generateAiImage(variants[i].id, variants[i].brief, `${basePrompt}\n图片内文字：${imageText || '禁止文字'}`, ratios[i], visualStyle);
            }
          })();
        }}
        onInsertAiImage={(src, brief, target) => {
          const editor = richEditorRef.current;
          if (!editor) return;
          if (target) {
            if (!isImageTargetCurrent(editor.state.doc, target, activeArticleId)) { say('文章已有变化，请重新为当前段落构思配图'); return; }
            editor.chain().focus().insertContentAt(target.insertAt, { type: 'image', attrs: { src, alt: brief } }).run();
          } else editor.chain().focus().setImage({ src, alt: brief }).run();
          say('图片已插入文章，原图也保存在配图工作区');
        }}
        aiTitleOptions={aiTitleOptions}
        aiResultMode={aiResultMode}
        aiRecommendedStyle={styles[aiRecommendation]?.name}
        aiConfigured={apiProvider !== '本地模拟' && Boolean(textApiKey)}
        aiMode={apiProvider}
        onOpenApiSettings={() => setApiOpen(true)}
        aiPhase={aiPhase === 'running' ? 'running' : aiPhase === 'ready' ? 'ready' : 'entry'}
        fontFamily={fontFamily}
        fontSize={fontSize}
        lineHeight={lineHeight}
        paragraphGap={paragraphGap}
        padX={padX}
        padY={padY}
        imageRadius={imageRadius}
        headingStyle={headingStyle}
        headingIcon={headingIcon}
        headingLabel={headingLabel}
        headingLabels={headingLabels}
        headingPrefix={headingPrefix}
        headingSeparator={headingSeparator}
        headingNumberFormat={headingNumberFormat}
        brandName={brandName}
        brandNote={brandNote}
        savedStylePresets={savedStylePresets.map(({ id, name, note, styleId }) => ({ id, name, note, styleName: styles.find((item) => item.id === styleId)?.name || styleId }))}
        activeSavedStyleId={activeSavedStyleId}
        savedStyleDirty={savedStyleDirty}
        onSaveStylePreset={saveStylePreset}
        onApplyStylePreset={applyStylePreset}
        onUpdateStylePreset={updateStylePreset}
        onDeleteStylePreset={deleteStylePreset}
        onFontFamilyChange={setFontFamily}
        onFontSizeChange={setFontSize}
        onLineHeightChange={setLineHeight}
        onParagraphGapChange={setParagraphGap}
        onPadXChange={setPadX}
        onPadYChange={setPadY}
        onImageRadiusChange={setImageRadius}
        onHeadingStyleChange={setHeadingStyle}
        onHeadingIconChange={setHeadingIcon}
        onHeadingLabelChange={setHeadingLabel}
        onHeadingPrefixChange={setHeadingPrefix}
        onHeadingSeparatorChange={setHeadingSeparator}
        onHeadingNumberFormatChange={setHeadingNumberFormat}
        onReadingChange={(reading) => {
          setFontSize(reading.fontSize);
          setLineHeight(reading.lineHeight);
          setParagraphGap(reading.paragraphGap);
          setPadX(reading.padX);
        }}
        paperMode={paperMode}
        paperColor={paperColor}
        paperTextureUrl={paperTextureUrl}
        onPaperTextureUrlChange={setPaperTextureUrl}
        onPaperModeChange={setPaperMode}
        onPaperColorChange={setPaperColor}
      />
      
      <section className="v091-pane v091-editor">
        <header className={reviewUi.header}><b>文章内容 <small>直接粘贴正文 · Markdown 自动识别</small></b><div className={reviewUi.tools}>
          <button className={reviewUi.check} onClick={() => { setPendingPlan(null); setAiRevision(null); void articleReview.run(); }} disabled={articleReview.phase === 'running' || aiPhase === 'running'}>{articleReview.phase === 'running' ? '正在检查…' : '检查文章'}</button>
          {!!articleReview.review.items.length && <button onClick={articleReview.next}>查看建议 · {articleReview.review.items.length}</button>}
          <button onClick={() => { loadMarkdown(sample); say('已载入完整示例'); }}>载入完整示例</button>
        </div></header>
        {(articleReview.message || articleReview.phase === 'running') && <div className={reviewUi.status} role={articleReview.phase === 'error' ? 'alert' : 'status'}>
          <p>{articleReview.phase === 'running' ? '正在阅读全文，检查完成后点击正文虚线查看建议。' : articleReview.phase === 'ready' && articleReview.review.items.length ? `${apiProvider === '本地模拟' ? '本地演示 · ' : ''}还有 ${articleReview.review.items.length} 处建议，点击正文虚线查看。` : articleReview.phase === 'ready' && articleReview.message.includes('处建议') ? '当前没有待处理建议。可继续编辑或重新检查。' : articleReview.message}</p>
          {articleReview.phase === 'running' && <button onClick={articleReview.cancel}>取消</button>}
        </div>}
        <EditorToolbar onPolish={() => void runAiTool('polish')} format={format} apply={apply} insertLink={insertLink} openEditorAction={openEditorAction}
          editImageCaption={editImageCaption} insertTable={insertTable} canUndo={canUndo} canRedo={canRedo}
          undoEditor={undoEditor} clearFormat={clearFormat} tidyDocument={tidyDocument}
          onInsertImage={() => imageInputRef.current?.click()}
          onHorizontalRule={() => { if (richEditorRef.current) { richEditorRef.current.chain().focus().setHorizontalRule().run(); return; } apply('---'); }} />
        {editorAction && <form className="v091-editor-action" onSubmit={(event) => { event.preventDefault(); submitEditorAction(); }}><label>{editorAction === 'link' ? '输入链接地址' : editorAction === 'image' ? '输入图片地址' : '编辑图片说明'}<input autoFocus value={editorActionValue} onChange={(event) => setEditorActionValue(event.target.value)} placeholder={editorAction === 'caption' ? '写一句图片说明' : 'https://...'} /></label><button type="submit">确认</button><button type="button" onClick={() => setEditorAction(null)}>取消</button></form>}
        <input ref={imageInputRef} className="v091-hidden-input" type="file" accept="image/*" onChange={insertImage} />
        <div className={`v091-editor-scroll ${reviewUi.editorHost}`} ref={editorScrollRef} onScroll={onEditorScroll} style={{ '--article-accent': accent, '--article-mark-bg': editorHighlight.backgroundColor, '--article-mark-image': editorHighlight.backgroundImage, '--article-mark-ink': editorHighlight.color, '--article-mark-padding': editorHighlight.padding } as React.CSSProperties}><RichEditor key={activeArticleId || 'initial'} value={content} document={documentJson} htmlToImport={htmlToImport} onChange={receiveEditorChange} onReady={receiveEditorReady} onReviewState={articleReview.setReview} /></div>
        <ArticleReviewPopover editor={richEditorRef.current} item={articleReview.active} onAdopt={articleReview.adopt} onIgnore={articleReview.dismiss} onClose={() => articleReview.select(null)} />
        {aiRevision && <div className="ai-revision-popover" role="dialog" aria-label={aiRevision.kind === 'title' ? '标题建议对照' : '润色对照'} style={{ top: aiRevision.top, left: aiRevision.left }}>
          <div className="ai-revision-head"><b>{aiRevision.kind === 'title' ? '标题建议' : '润色批改'}</b><button type="button" onClick={() => { requestScope.cancel('revision'); setAiRevision(null); }} aria-label="关闭批改框">×</button></div>
          <div className="ai-revision-compare"><div><small>原文</small><p>{aiRevision.original}</p></div><div><small>建议版本</small><textarea value={aiRevision.proposal} onChange={(event) => setAiRevision((current) => current ? { ...current, proposal: event.target.value } : current)} placeholder={aiRevision.status === 'running' ? '正在生成建议…' : '这里可以直接修改建议'} /></div></div>
          {aiRevision.alternatives.length > 0 && <div className="ai-revision-alternatives">{aiRevision.alternatives.map((title, index) => <button type="button" key={`${index}-${title}`} onClick={() => setAiRevision((current) => current ? { ...current, proposal: title } : current)}>{index + 1}. {title}</button>)}</div>}
          <label className="ai-revision-instruction">继续优化<input value={revisionInstruction} onChange={(event) => setRevisionInstruction(event.target.value)} placeholder="例如：更简洁、保留某个细节" /></label>
          {aiRevision.error && <p className="ai-revision-error">{aiRevision.error}</p>}
          <div className="ai-revision-actions"><button type="button" onClick={() => void makeRevision(aiRevision, revisionInstruction)} disabled={aiRevision.status === 'running'}>重新生成</button><button type="button" onClick={applyRevision} disabled={!aiRevision.proposal.trim() || aiRevision.status === 'running'}>应用到文章</button></div>
        </div>}
        <textarea className="v091-legacy-source" ref={editorRef} aria-label="Markdown 源文稿" value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); restoreHistory(event.shiftKey ? 1 : -1); } }} tabIndex={-1} />
      </section>
      <ArticlePreview styleId={styleDef.id} headingStyle={headingStyle} variant={variant} paperMode={paperMode}
        background={paperMode === 'follow' ? undefined : paperMode === 'custom' ? paperColor : styleDef.paper || '#ffffff'}
        proposal={tab === 'ai' ? proposalPreview : undefined}
        html={wechatPreviewHtml} scrollRef={previewScrollRef} onScroll={onPreviewScroll} />
    </section>
    <footer><span>{wordCount} 字</span><span>约 {readMinutes} 分钟</span><span>{codeCount} 个代码块</span><span>{imageCount} 张图</span><span>文章保存在本机</span><PlatformStatus /></footer>{apiOpen && <ApiSettings profiles={apiProfiles} roles={apiRoles} onClose={() => setApiOpen(false)} onChange={(profiles, roles) => { applyApiProfiles(profiles, roles); say('API 配置已更新'); }} />}{helpOpen && <div className="v091-modal-backdrop" role="dialog" aria-modal="true" aria-label="使用说明"><section className="v091-local-api-modal v091-help-modal"><button className="v091-modal-close" onClick={() => setHelpOpen(false)} aria-label="关闭">×</button><small>KAIPAI / QUICK START</small><h2>使用说明</h2><ol><li>导入或直接粘贴 Markdown 正文。</li><li>从 12 套 Style 中选择整篇文章的设计语言。</li><li>在组件面板插入导语、重点、提醒、分割、推荐或关注模块。</li><li>在右侧预览检查图片、表格、代码和阅读密度。</li><li>复制公众号正文；有待上传图片时，下载图片包并按编号在公众号后台上传。</li></ol><button className="v091-btn primary" onClick={() => setHelpOpen(false)}>开始编辑</button></section></div>}{notice && <div className="v091-toast">{notice}</div>}
  </main>;
}
