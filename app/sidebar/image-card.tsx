import { useState, useEffect } from 'react';
import type { V091SidebarProps } from './shared';
import ui from '../ai-workspace.module.css';

export function ImageCard({ card, index, p, ratios, visualStyle }: {
  card: NonNullable<V091SidebarProps['aiImageCards']>[number];
  index: number;
  p: V091SidebarProps;
  ratios: string[];
  visualStyle: string;
}) {
  const [selectedRatios, setSelectedRatios] = useState(card.ratio ? [card.ratio] : card.brief.includes('封面') ? ['2.35:1'] : ratios);
  const loading = card.status === 'loading';
  const cover = card.brief.startsWith('封面');
  const [style, setStyle] = useState(card.visualStyle || visualStyle);
  const [withText, setWithText] = useState(Boolean(card.imageText));
  const [imageText, setImageText] = useState(card.imageText || '');
  const [enlarged, setEnlarged] = useState(false);
  const [prompt, setPrompt] = useState(card.prompt);
  const [caption, setCaption] = useState(card.brief);
  useEffect(() => setPrompt(card.prompt), [card.prompt]);
  useEffect(() => setCaption(card.brief), [card.brief]);
  return <article className={ui.imageCard} aria-label={`第 ${index + 1} 张配图`} data-ai-image-id={card.id}>
    <div className={ui.imageCardTitle}><span>{String(index + 1).padStart(2, '0')}</span><b>{card.brief.split('｜')[0]}</b></div>
    <p className={ui.imageDescription}>{card.brief.split('｜').slice(1).join('｜') || card.prompt}</p>
    {card.src && <button className={ui.imagePreview} onClick={() => setEnlarged(!enlarged)} aria-label={enlarged ? '收起图片' : '放大图片'} aria-expanded={enlarged}><img src={card.src} alt={caption} style={enlarged ? { maxHeight: 'none' } : undefined} /></button>}
    {card.target && <small className={ui.target}>插入位置：这段内容之后<br />{card.target.text.slice(0, 58)}{card.target.text.length > 58 ? '…' : ''}</small>}
    <fieldset className={ui.imageOptions} disabled={loading}><legend>图片比例 · 可多选</legend>{['2.35:1', '1:1', '4:3', '9:16'].map(ratio => <label key={ratio}><input type="checkbox" checked={selectedRatios.includes(ratio)} onChange={e => setSelectedRatios(current => e.target.checked ? [...current, ratio] : current.filter(x => x !== ratio))} />{ratio}</label>)}</fieldset>
      <label className={ui.checkbox}><input type="checkbox" disabled={loading} checked={withText} onChange={e => { setWithText(e.target.checked); if (e.target.checked && !imageText) setImageText(card.brief.split('｜')[1]?.split(/[，。]/)[0] || ''); }} />图片中带文字</label>
    {withText && <label className={ui.field}>图片中的文字<input disabled={loading} value={imageText} onChange={e => setImageText(e.target.value)} placeholder="填写图片中的标题" /></label>}
    <details className={ui.details}><summary>{card.src ? '调整画面与重新生成' : '风格与画面要求'}</summary>
      <label className={ui.field}>视觉风格<input disabled={loading} value={style} onChange={e => setStyle(e.target.value)} /></label>
      <label className={ui.field}>画面要求<textarea disabled={loading} value={prompt} onChange={e => setPrompt(e.target.value)} /></label>
      {card.src && <><label className={ui.field}>图注<input value={caption} onChange={e => setCaption(e.target.value)} placeholder="图注（可清空）" /></label><button className={ui.secondary} disabled={loading} onClick={generate}>重新生成</button></>}
    </details>
    {loading && <p role="status">正在生成图片…</p>}
    {card.error && <p className={ui.imageError} role="alert">{card.error}</p>}
    {!card.src && <button className={ui.primary} disabled={loading} onClick={generate}>{loading ? '正在生成…' : card.error ? '重试生成' : '生成这张图'}<span aria-hidden="true">→</span></button>}
    {card.src && <div className={ui.imageActions}>
      {!cover && <button className={ui.primary} disabled={loading || p.aiHasPendingPlan} onClick={() => p.onInsertAiImage?.(card.src, caption.trim(), card.target)}>插入正文</button>}
      <a className={ui.secondary} href={card.src} download={`公众号配图-${index + 1}.png`}>{cover ? '下载封面' : '下载图片'}</a>
    </div>}
    {card.src && p.aiHasPendingPlan && !cover && <p>应用排版后即可插入图片。</p>}
  </article>;

  function generate() {
    if (!selectedRatios.length) { p.onSay('请至少选择一种比例'); return; }
    if (withText && !imageText.trim()) { p.onSay('请填写图片内文字'); return; }
    p.onGenerateAiImage?.(card.id, prompt.trim(), selectedRatios, style, withText ? imageText.trim() : '');
  }
}
