'use client';

import { aiFetch } from '../../lib/ai-transport';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ApiProfile, ApiProfileRoles, ApiModelConfig } from '../../lib/api-profiles';
import { requestAi, type AiRequest } from '../../lib/providers';
import { checkCoverRatio, resolveCoverRatio, parseCoverPrompt, parseCoverRecommendations, type CoverMode, type CoverOptions, type CoverRatio, type CoverRecommendation, type CoverStyle, type CoverReview, type CoverRecord } from '../../lib/cover-design';
import { saveGeneratedImage, type GeneratedImage } from '../../lib/generated-images';
import ui from '../ai-workspace.module.css';

export type CoverContext = { article: string; articleId: string; profiles: ApiProfile[]; roles: ApiProfileRoles; onSaved: (image: GeneratedImage) => void; configure: () => void };
type Candidate = { id: string; styleName: string; src: string; prompt: string; options: CoverOptions; width: number; height: number; generationRatio: string; review?: CoverReview; error?: string; saved?: boolean };
type Connection = { profile: ApiProfile; model: ApiModelConfig };
function textInput(connection: Connection): Pick<AiRequest, 'provider' | 'apiKey' | 'endpoint' | 'model' | 'adapter'> {
  return { provider: connection.profile.provider, apiKey: connection.profile.apiKey, endpoint: connection.profile.baseUrl, model: connection.model.modelId, adapter: connection.model.adapter === 'openai-responses' ? 'openai-responses' : 'openai-chat' };
}
function articleTitle(article: string) { return article.split('\n').find(line => line.trim())?.replace(/^#{1,6}\s*/, '').trim() || ''; }
function fileExtension(src: string) { return src.startsWith('data:image/jpeg') ? 'jpg' : src.startsWith('data:image/webp') ? 'webp' : 'png'; }

export function CoverDesigner({ context, active = true }: { context: CoverContext; active?: boolean }) {
  const { article, articleId, profiles, roles, onSaved, configure } = context;
  const [mode, setMode] = useState<CoverMode | ''>('');
  const [title, setTitle] = useState(articleTitle(article));
  const [ratio, setRatio] = useState<CoverRatio>('2.35:1');
  const [instruction, setInstruction] = useState('');
  const [styles, setStyles] = useState<CoverStyle[]>([]);
  const [version, setVersion] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [recommendations, setRecommendations] = useState<CoverRecommendation[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [budget, setBudget] = useState(2);
  const [results, setResults] = useState<Candidate[]>([]);
  const [preview, setPreview] = useState<Candidate | null>(null);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  const busy = Boolean(phase);
  const textProfile = profiles.find(profile => profile.id === roles.textId);
  const textModel = textProfile?.modelConfigs.find(model => model.enabled && model.id === roles.textModelId) || textProfile?.modelConfigs.find(model => model.enabled && model.capabilities.includes('text'));
  const imageProfile = profiles.find(profile => profile.id === roles.imageId);
  const imageModel = imageProfile?.modelConfigs.find(model => model.enabled && model.id === roles.imageModelId) || imageProfile?.modelConfigs.find(model => model.enabled && model.capabilities.includes('image-generation'));
  // Existing saved profiles predate the vision capability field. Let users choose
  // a compatible text connection; the real image request must succeed before delivery.
  const reviewers = profiles.flatMap(profile => profile.modelConfigs.filter(model => model.enabled && (model.capabilities.includes('vision') || model.capabilities.includes('text')) && ['openai-chat', 'openai-responses'].includes(model.adapter)).map(model => ({ profile, model })));
  const reviewerKey = (entry: Connection) => `${entry.profile.id}/${entry.model.id}`;
  const reviewer = reviewers.find(entry => reviewerKey(entry) === reviewerId) || reviewers.find(entry => entry.model.id === roles.textModelId) || reviewers[0];

  useEffect(() => {
    controller.current?.abort(); setPhase(''); setError(''); setResults([]); setPreview(null); setRecommendations([]);
    setTitle(articleTitle(article));
    return () => controller.current?.abort();
  }, [article, articleId, profiles, roles]);
  useEffect(() => {
    if (!active) { controller.current?.abort(); setPhase(''); }
  }, [active]);
  useEffect(() => {
    setStyles([]); setCatalogError(''); setSelected([]); setRecommendations([]); setResults([]);
    if (!mode) return;
    const abort = new AbortController();
    void fetch(`/api/ai/design?mode=${mode}`, { signal: abort.signal, cache: 'no-store' }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.styles)) throw new Error('风格目录加载失败');
      if (!abort.signal.aborted) { setStyles(data.styles); setVersion(data.version); }
    }).catch(() => { if (!abort.signal.aborted) setCatalogError('风格目录未加载，请重试'); });
    return () => abort.abort();
  }, [mode, catalogAttempt]);

  function options(styleId?: string): CoverOptions {
    if (!mode) throw new Error('请先选择有字或无字封面');
    if (mode === 'with-text' && !title.trim()) throw new Error('请填写完整封面标题');
    return { mode, title: mode === 'with-text' ? title.trim() : '', styleId, aspectRatio: ratio, instruction };
  }
  function invalidate() { setResults([]); setPreview(null); setError(''); }
  function begin() { controller.current?.abort(); const job = new AbortController(); controller.current = job; setError(''); return job; }
  function ensureText(): Connection {
    if (!textProfile || !textModel || !textProfile.apiKey) { configure(); throw new Error('请先配置文章模型，用于理解文章和构思'); }
    if (!article.trim()) throw new Error('请先填写文章');
    return { profile: textProfile, model: textModel };
  }
  async function ask(operation: 'design-recommend' | 'design-compose' | 'design-review', design: CoverOptions, connection: Connection, job: AbortController, image?: string) {
    if (job.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    const result = await requestAi({ ...textInput(connection), operation, article, design, image, prompt: '' }, job.signal);
    if (job.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (!result.ok) throw new Error(result.error);
    return result;
  }
  async function recommend() {
    const job = begin();
    try {
      const connection = ensureText(); const design = options();
      setPhase('正在阅读全文，选择三种风格');
      const result = await ask('design-recommend', design, connection, job);
      setRecommendations(parseCoverRecommendations(result.text, styles));
    } catch (failure) { if (!job.signal.aborted) setError(failure instanceof Error ? failure.message : '风格推荐失败'); }
    finally { if (controller.current === job) setPhase(''); }
  }
  async function inspect(candidate: Candidate, connection: Connection, job: AbortController) {
    setPhase(`正在看图审核 · ${candidate.styleName}`);
    const result = await ask('design-review', { ...candidate.options, generationRatio: candidate.generationRatio }, connection, job, candidate.src);
    if (!result.review) throw new Error('未取得看图审核记录，图片仍待审核');
    // Bind the returned evidence to the actual unchanged image bytes.
    const bytes = await (await fetch(candidate.src)).arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (job.signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (hash !== result.review.imageSha256) throw new Error('审核记录与图片不匹配，请重新审核');
    return result.review;
  }
  async function keep(candidate: Candidate, review: CoverReview, job: AbortController) {
    const cover: CoverRecord = { options: candidate.options, prompt: candidate.prompt, review, width: candidate.width, height: candidate.height, requestedRatio: candidate.options.aspectRatio, generationRatio: candidate.generationRatio, skillVersion: version };
    const image: GeneratedImage = { id: candidate.id, src: candidate.src, brief: `封面｜${candidate.styleName}`, prompt: candidate.prompt, createdAt: Date.now(), cover };
    if (job.signal.aborted) return;
    await saveGeneratedImage(image, job.signal); if (!job.signal.aborted) onSaved(image);
  }
  function update(candidate: Candidate) { setResults(current => [...current.filter(item => item.id !== candidate.id), candidate]); }

  async function generate() {
    const job = begin(); setResults([]);
    try {
      const connection = ensureText();
      if (!imageProfile || !imageModel) { configure(); throw new Error('请配置配图模型'); }
      if (!reviewer) { configure(); throw new Error('请配置支持图片输入的审核模型；审核通过后才能作为成品下载'); }
      if (!selected.length) throw new Error('请先选择至少一种风格');
      for (const styleId of selected) {
        let design = options(styleId);
        let last: Candidate | undefined;
        for (let attempt = 1; attempt <= budget; attempt++) {
          const styleName = styles.find(style => style.id === styleId)!.name;
          setPhase(`正在${attempt === 1 ? '构思' : '调整构思'} · ${styleName} · ${attempt}/${budget}`);
          const composed = await ask('design-compose', design, connection, job);
          const prompt = parseCoverPrompt(composed.text);
          setPhase(`正在生成 · ${styleName} · ${attempt}/${budget}`);
          const response = await aiFetch('/api/ai/image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: job.signal, cache: 'no-store', body: JSON.stringify({ provider: imageProfile.provider, baseUrl: imageProfile.baseUrl, apiKey: imageProfile.apiKey, model: imageModel.modelId, adapter: imageModel.adapter, aspectRatio: design.aspectRatio, design, prompt }) });
          const data = await response.json();
          if (!response.ok || !data.ok || typeof data.src !== 'string') throw new Error(data.error || '图片生成失败');
          if (job.signal.aborted) return;
          const image = new window.Image(); image.src = data.src; await image.decode();
          if (job.signal.aborted) return;
          const generationRatio = resolveCoverRatio(image.naturalWidth, image.naturalHeight, design.aspectRatio, typeof data.generationRatio === 'string' ? data.generationRatio : design.aspectRatio);
          const candidate: Candidate = { id: last?.id || crypto.randomUUID(), styleName, src: data.src, prompt, options: design, width: image.naturalWidth, height: image.naturalHeight, generationRatio };
          last = candidate;
          if (!checkCoverRatio(image.naturalWidth, image.naturalHeight, generationRatio)) {
            candidate.error = `图片实际为 ${image.naturalWidth} × ${image.naturalHeight}，不符合本次生成画幅，完整原图未裁切。`;
            update(candidate);
            design = { ...design, previousPrompt: prompt, feedback: candidate.error };
            continue;
          }
          update(candidate);
          const review = await inspect(candidate, reviewer, job);
          candidate.review = review; update({ ...candidate });
          if (review.status === 'passed') {
            try { await keep(candidate, review, job); candidate.saved = true; }
            catch { candidate.error = '已通过审核，但本机保存失败；请下载保留图片'; }
            if (!job.signal.aborted) update({ ...candidate });
            break;
          }
          if (review.status === 'unverified') break;
          design = { ...design, previousPrompt: prompt, feedback: [review.feedback, review.evidence, ...Object.values(review.checks).filter(check => check.status !== 'pass' && check.status !== 'not_applicable').map(check => check.evidence)].filter(Boolean).join('\n') };
        }
      }
    } catch (failure) { if (!job.signal.aborted) setError(failure instanceof Error ? failure.message : '封面生成未完成'); }
    finally { if (controller.current === job) setPhase(''); }
  }
  async function retryReview(candidate: Candidate) {
    const job = begin();
    try {
      if (!reviewer) { configure(); throw new Error('请配置看图审核模型'); }
      if (!checkCoverRatio(candidate.width, candidate.height, candidate.generationRatio)) throw new Error('图片尺寸尚未通过，请重新生成');
      const review = await inspect(candidate, reviewer, job);
      const next = { ...candidate, review, error: undefined };
      if (review.status === 'passed') { await keep(next, review, job); next.saved = true; }
      if (!job.signal.aborted) update(next);
    } catch (failure) { if (!job.signal.aborted) setError(failure instanceof Error ? failure.message : '审核未完成'); }
    finally { if (controller.current === job) setPhase(''); }
  }

  return <section aria-label="新版封面设计" className={ui.coverDesigner} aria-busy={busy}>
    <div className={ui.coverModes} role="group" aria-label="封面文字">
      <button disabled={busy} aria-pressed={mode === 'with-text'} onClick={() => { setMode('with-text'); invalidate(); }}>有字封面</button>
      <button disabled={busy} aria-pressed={mode === 'wordless'} onClick={() => { setMode('wordless'); invalidate(); }}>无字封面</button>
    </div>
    {!mode ? <p>先选择封面是否带文字。</p> : <>
      {mode === 'with-text' && <label className={ui.field}>完整封面标题<textarea rows={2} maxLength={300} disabled={busy} value={title} onChange={event => { setTitle(event.target.value); invalidate(); setRecommendations([]); }} /><small className={ui.note}>保留完整标题；改动这里只影响封面，不改正文。</small></label>}
      <label className={ui.field}>微信公众号封面比例<select disabled={busy} value={ratio} onChange={event => { setRatio(event.target.value as CoverRatio); invalidate(); }}><option value="2.35:1">2.35:1 · 文章封面</option><option value="1:1">1:1 · 方形兼容版</option><option value="4:3">4:3 · 自定义横图</option><option value="9:16">9:16 · 自定义竖图</option></select></label>
      <label className={ui.field}>补充要求 <span>选填</span><textarea rows={2} maxLength={1000} disabled={busy} value={instruction} onChange={event => { setInstruction(event.target.value); invalidate(); setRecommendations([]); }} placeholder="喜欢的画面气质、需要保留的内容" /></label>
      <div className={ui.sectionHead}><b>选择视觉风格</b><button className={ui.smallButton} disabled={busy || !styles.length} onClick={recommend}>{recommendations.length ? '重新推荐三种' : '根据文章推荐三种'}</button></div>
      {catalogError && <p role="alert">{catalogError} <button className={ui.smallButton} onClick={() => setCatalogAttempt(value => value + 1)}>重试加载</button></p>}
      <div className={ui.coverRecommendations}>{recommendations.map(item => <button key={item.id} disabled={busy} aria-pressed={selected.includes(item.id)} onClick={() => { setSelected(current => current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id]); invalidate(); }}><b>{styles.find(style => style.id === item.id)?.name}</b><span>{item.reason}</span></button>)}</div>
      <label className={ui.field}>也可以直接选风格 · 可多选<select disabled={busy || !styles.length} value="" onChange={event => { const id = event.target.value; if (id) setSelected(current => current.includes(id) ? current : [...current, id]); invalidate(); }}><option value="">{styles.length ? '从全部风格中添加' : '正在加载风格…'}</option>{styles.filter(style => !selected.includes(style.id)).map(style => <option key={style.id} value={style.id}>{style.name}{style.conditional ? ' · 需符合适用条件' : ''}</option>)}</select></label>
      {!!selected.length && <div className={ui.coverSelected} aria-label="已选封面风格">{selected.map(id => <button key={id} className={ui.smallButton} disabled={busy} onClick={() => { setSelected(current => current.filter(item => item !== id)); invalidate(); }}>{styles.find(style => style.id === id)?.name} ×</button>)}</div>}
      <details className={ui.details}><summary>审核与生成额度</summary>
        <label className={ui.field}>看图审核模型<select disabled={busy} value={reviewer ? reviewerKey(reviewer) : ''} onChange={event => setReviewerId(event.target.value)}>{!reviewers.length && <option value="">尚未配置看图模型</option>}{reviewers.map(entry => <option key={reviewerKey(entry)} value={reviewerKey(entry)}>{entry.profile.name} · {entry.model.displayName || entry.model.modelId}</option>)}</select></label>
        <label className={ui.field}>每种风格最多生成<select disabled={busy} value={budget} onChange={event => setBudget(Number(event.target.value))}>{[1, 2, 3].map(value => <option key={value} value={value}>{value} 次{value > 1 ? ' · 未通过时自动调整' : ''}</option>)}</select></label>
        <p>审核模型需支持图片输入。每张原图单独审核；接口拒绝、审核缺项或未通过时不作为成品。支持的最近画幅会保留完整原图。</p>
        {!reviewer && <button className={ui.smallButton} onClick={configure}>配置看图能力</button>}
      </details>
      {busy ? <div className={ui.progress} role="status"><span className={ui.spinner} aria-hidden="true" /><div><b>{phase}</b></div><button className={ui.smallButton} onClick={() => { controller.current?.abort(); setPhase(''); setError('已停止，尚未审核通过的图片保留为候选。'); }}>停止</button></div> : <><button className={ui.primary} disabled={!selected.length || !styles.length} onClick={generate}>{selected.length ? `生成 ${selected.length} 张并审核` : '选择风格后生成'}</button><small className={ui.note}>每种风格最多 {budget} 次生成；通过后保存完整原图。</small></>}
    </>}
    {error && <p className={ui.imageError} role="alert">{error}</p>}
    {!!results.length && <div className={ui.imageList}>{results.map(candidate => <article key={candidate.id} className={ui.imageCard} aria-label={`${candidate.styleName}封面结果`}>
      <div className={ui.sectionHead}><b>{candidate.styleName}</b><span>{candidate.review?.status === 'passed' ? '模型看图审核通过' : candidate.review?.status === 'failed' ? '未通过 · 待调整' : '待审核通过'}</span></div>
      <button className={ui.imagePreview} aria-label={`放大${candidate.styleName}封面`} onClick={() => setPreview(candidate)}><img className={ui.coverResult} src={candidate.src} alt={`${candidate.styleName}封面${candidate.review?.status === 'passed' ? '' : '候选，尚未通过'}`} /></button>
      <small className={ui.note}>{candidate.width} × {candidate.height} px · 原图完整保留{candidate.generationRatio !== candidate.options.aspectRatio ? ` · 模型生成画幅 ${candidate.generationRatio}` : ''}</small>
      {candidate.error && <p role="alert">{candidate.error}</p>}
      {candidate.review && <><p className={ui.imageDescription}>{candidate.review.status === 'passed' ? candidate.review.evidence : candidate.review.feedback || candidate.review.evidence}</p><details className={ui.details}><summary>查看审核依据</summary>{Object.entries(candidate.review.checks).map(([key, check]) => <p key={key}>{({ text: '文字', content: '内容', action: '结构与动作', style: '风格', readability: '展示效果', preservation: '保留项' } as Record<string, string>)[key]} · {({ pass: '通过', fail: '需修正', unverified: '未验证', not_applicable: '不适用' })[check.status]}：{check.evidence}</p>)}</details></>}
      {candidate.review?.status === 'passed' ? <a className={ui.primary} href={candidate.src} download={`楷排封面-${candidate.options.styleId}.${fileExtension(candidate.src)}`}>下载封面</a> : <button className={ui.secondary} disabled={busy} onClick={() => retryReview(candidate)}>重试看图审核</button>}
    </article>)}</div>}
    {preview && <CoverPreview candidate={preview} onClose={() => setPreview(null)} />}
  </section>;
}

function CoverPreview({ candidate, onClose }: { candidate: Candidate; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; close.current?.focus(); return () => previous?.focus(); }, []);
  return createPortal(<div className={ui.coverLightbox} role="dialog" aria-modal="true" aria-label="封面大图" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => { if (event.key === 'Escape') onClose(); if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); } }}>
    <section><div><span>{candidate.styleName} · {candidate.review?.status === 'passed' ? '模型审核通过' : '候选，尚未通过'}</span><button ref={close} onClick={onClose}>关闭大图</button></div><img src={candidate.src} alt={`${candidate.styleName}封面大图`} /></section>
  </div>, document.body);
}
