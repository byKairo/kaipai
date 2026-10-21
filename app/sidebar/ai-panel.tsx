import { useEffect, useRef, useState } from 'react';
import { ImageCard } from './image-card';
import { CoverDesigner } from './cover-designer';
import { StyleThumb } from './style-thumb';
import { STYLE_ORDER } from './shared';
import type { SidebarModel } from './controller';
import type { ImageScope } from '../../lib/ai-workbench';
import ui from '../ai-workspace.module.css';

export function AiPanel({ model }: { model: SidebarModel }) {
  const { p, phase } = model;
  const [task, setTask] = useState<'layout' | 'images'>('layout');
  const [styleChoice, setStyleChoice] = useState('');
  const [styleOpen, setStyleOpen] = useState(false);
  const [imageScope, setImageScope] = useState<ImageScope>('cover');
  const [imageInstruction, setImageInstruction] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const styleTrigger = useRef<HTMLButtonElement>(null);
  const running = phase === 'running';
  const reviewing = Boolean(p.aiHasPendingPlan);
  const images = !reviewing && task === 'images';
  const generatingImages = p.aiImageCards?.some(card => card.status === 'loading');
  const selectedStyle = p.styles.find(style => reviewing ? style.name === p.aiRecommendedStyle : Boolean(styleChoice) && style.id === p.styleId);
  const hasImages = Boolean(p.aiImageCards?.length);
  const applied = phase === 'ready' && !reviewing && (p.aiResultMode === 'full' || p.aiResultMode === 'layout');
  const error = p.aiPlanError && (p.aiResultMode === 'images') === images ? p.aiPlanError : '';

  useEffect(() => {
    if (!running) return;
    setTask(p.aiResultMode === 'images' ? 'images' : 'layout');
    setStyleOpen(false);
    setElapsed(0);
    const start = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [running, p.aiResultMode]);

  function pickStyle(id: string) {
    if (reviewing) p.onPlanStyleChange?.(id);
    else { setStyleChoice(id); if (id) p.onStyleChange(id); }
    setStyleOpen(false);
    styleTrigger.current?.focus();
  }

  return <div className={`side-body ${ui.panel}`} id="tab-ai" hidden={p.tab !== 'ai'}>
    <div className={ui.header}><h2><span aria-hidden="true">✦</span> AI 创作</h2><button className={ui.smallButton} onClick={p.onOpenApiSettings}>服务设置</button></div>
    <div className={ui.switcher} role="group" aria-label="选择 AI 任务">
      <button aria-pressed={!images} disabled={running} onClick={() => setTask('layout')}>文章排版</button>
      <button aria-pressed={images} disabled={running || reviewing} onClick={() => setTask('images')}>封面与配图</button>
    </div>

    <section className={ui.workspace} aria-label={images ? '封面与配图' : '文章排版'} aria-busy={running}>
      <div className={ui.sectionHead}><b>{images ? '给哪里配图？' : reviewing ? '排版方案已就绪' : '整理全文排版'}</b><span>{images ? 'Kairo Design' : 'Kairo Layout'}</span></div>
      {!images && <>
        <p className={ui.description}>{reviewing ? '在右侧对照效果，确认后应用。' : '整理段落、标题和重点，先预览再应用。'}</p>
        <div className={ui.stylePicker} onKeyDown={event => { if (event.key === 'Escape') { setStyleOpen(false); styleTrigger.current?.focus(); } }}>
          <button ref={styleTrigger} className={ui.styleTrigger} disabled={running} aria-expanded={styleOpen} aria-controls="ai-style-options" onClick={() => setStyleOpen(open => !open)}>
            <span className={ui.currentThumb}><StyleThumb id={selectedStyle?.id || p.styleId} /></span>
            <span className={ui.styleLabel}><small>{reviewing ? '方案风格' : '排版风格'}</small><b>{selectedStyle?.name || 'AI 推荐'}</b><small>{selectedStyle ? selectedStyle.grammar.split(' · ').slice(0, 2).join(' · ') : '根据文章选择，可手动指定'}</small></span><span aria-hidden="true">{styleOpen ? '−' : '⌄'}</span>
          </button>
          {styleOpen && <div className={ui.styleMenu} id="ai-style-options" aria-label="排版风格选项">
            {!reviewing && <button className={ui.autoStyle} aria-pressed={!styleChoice} onClick={() => pickStyle('')}>✦ AI 推荐 <small>根据文章选择</small>{!styleChoice && <span aria-hidden="true">✓</span>}</button>}
            <div className={ui.styleGrid}>{STYLE_ORDER.map(id => { const style = p.styles.find(item => item.id === id); if (!style) return null; return <button key={id} className={ui.styleOption} aria-label={`选择${style.name}`} aria-pressed={selectedStyle?.id === id} onClick={() => pickStyle(id)}><StyleThumb id={id} /><span>{style.name}</span>{selectedStyle?.id === id && <i aria-hidden="true">✓</i>}</button>; })}</div>
          </div>}
        </div>
      </>}

      {images && <div className={ui.imageComposer}>
        <div className={ui.scopeSwitch} role="group" aria-label="配图用途">{([['cover', '文章封面'], ['selection', '当前段落'], ['article', '整篇推荐']] as const).map(([scope, label]) => <button key={scope} aria-pressed={imageScope === scope} disabled={running || generatingImages} onClick={() => setImageScope(scope)}>{label}</button>)}</div>
        <p className={ui.description}>{imageScope === 'cover' ? '按有字或无字路线构思，生成后看图审核。' : imageScope === 'selection' ? '先在正文中点击或选中段落，配图将插在它后面。' : '读完整篇文章，推荐正文插图的位置；封面请在“文章封面”中制作。'}</p>
        {imageScope === 'cover' && p.coverContext ? <CoverDesigner context={p.coverContext} /> : <>
        <label className={ui.field}>补充要求 <span>选填</span><textarea rows={2} maxLength={800} disabled={running || generatingImages} value={imageInstruction} onChange={event => setImageInstruction(event.target.value)} placeholder="例如：手绘风格，不要文字" /></label>
        <div className={ui.styleLink}><span>配图跟随：{p.styleName}</span><button className={ui.smallButton} disabled={running || reviewing} onClick={() => p.onTabChange('layout')}>换风格 ↗</button></div>
        </>}
      </div>}

      {running ? <div className={ui.progress} role="status"><span className={ui.spinner} aria-hidden="true" /><div><b>{images ? '正在构思配图' : '正在整理排版'}</b><p>已等待 {elapsed} 秒{elapsed >= 30 ? ' · 模型仍在处理' : ''}</p></div><button className={ui.smallButton} onClick={p.onCancelAiPlan}>取消</button></div>
        : error ? <div className={ui.error} role="alert"><b>这次没有完成</b><p>{error}</p><div className={ui.actions}><button className={ui.primary} onClick={p.onRetryAiPlan}>重试</button><button className={ui.secondary} onClick={p.onOpenApiSettings}>检查设置</button></div><small>原文已保留。</small></div>
        : reviewing ? <>
          {!!p.aiSuggestions?.length && <details className={ui.details}><summary>编辑建议 · {p.aiSuggestions.length} 条</summary><ul>{p.aiSuggestions.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
          <div className={ui.actions}><button className={ui.primary} onClick={p.onApplyAiPlan}>✓ 应用排版</button><button className={ui.secondary} onClick={p.onDiscardAiPlan}>保留原文</button></div>
        </> : images ? imageScope === 'cover' && p.coverContext ? null : <button className={ui.primary} disabled={generatingImages} onClick={() => p.onPlanAiImages?.(imageScope, imageInstruction)}>{hasImages ? '重新构思配图' : imageScope === 'cover' ? '✦ 构思封面' : imageScope === 'selection' ? '✦ 为当前段落构思配图' : '✦ 推荐整篇配图'}</button>
        : <><button className={ui.primary} onClick={() => p.onRunAiPlan?.({ styleId: styleChoice ? p.styleId : undefined })}>{applied ? '✦ 重新整理全文' : '✦ 生成排版方案'}</button>{applied && <div className={ui.success} role="status"><span>✓ 排版已应用</span><button className={ui.smallButton} onClick={() => setTask('images')}>继续配图 →</button></div>}</>}

      {!running && !(images && imageScope === 'cover' && p.coverContext) && <small className={ui.note}>{p.aiMode === '本地模拟' ? images ? '本地构思演示 · 生图需连接配图模型' : '本地演示 · 仅做基础整理' : images ? '先构思画面，确认后逐张生成' : '确认前不改动原文'}</small>}
      {images && imageScope !== 'cover' && hasImages && !running && !error && <div className={ui.imageResults}><div className={ui.sectionHead}><b>画面建议</b><span>{p.aiImageCards?.length} 张</span></div><div className={ui.imageList}>{p.aiImageCards?.map((card, index) => <ImageCard key={card.id} card={card} index={index} p={p} ratios={['4:3']} visualStyle="跟随文章风格" />)}</div></div>}
      {images && imageScope !== 'cover' && !!p.aiSavedImages?.length && <details className={ui.history}><summary>已保存图片 · {p.aiSavedImages.length}</summary><div>{p.aiSavedImages.map(image => <button key={image.id} onClick={() => p.onPreviewSavedImage?.(image.id)}><img src={image.src} alt={image.brief} /><span>{image.brief}</span></button>)}</div></details>}
    </section>

    {!images && !running && !reviewing && <section className={ui.quickTools} aria-label="局部编辑"><div className={ui.sectionHead}><b>局部编辑</b><span>选中后处理</span></div><div className={ui.actions}><button className={ui.secondary} onClick={() => p.onRunAiTool?.('polish')}>润色选中文字</button><button className={ui.secondary} onClick={() => p.onRunAiTool?.('title')}>优化标题</button></div></section>}
  </div>;
}
