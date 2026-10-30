import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { V091SidebarProps } from './shared';
import ui from '../ai-workspace.module.css';

type SavedImage = NonNullable<V091SidebarProps['aiSavedImages']>[number];
function extension(src: string) {
  const mime = /^data:image\/(png|jpeg|webp|gif|avif)[;,]/i.exec(src)?.[1].toLowerCase();
  return mime === 'jpeg' ? 'jpg' : mime || 'png';
}

export function GeneratedImageHistory({ p, onEdit }: { p: V091SidebarProps; onEdit: (id: string) => void }) {
  const [preview, setPreview] = useState<SavedImage | null>(null);
  const images = p.aiSavedImages || [];
  function confirmDelete(image: SavedImage) {
    if (!p.onDeleteSavedImage || p.aiImageHistoryLoading || p.aiImageHistoryDeletingId) return;
    if (!window.confirm(`确定删除这张${image.cover ? '封面' : '配图'}吗？\n${image.brief}\n\n删除后无法从历史图片库恢复。已插入文章的图片和已下载的文件不受影响。`)) return;
    void p.onDeleteSavedImage(image.id);
  }
  return <details className={ui.history}>
    <summary>历史封面与配图 · 已加载 {images.length} 张</summary>
    <p>保存在当前浏览器中，每次加载 12 张。</p>
    <div className={ui.historyGrid} aria-label="历史封面与配图">
      {images.map(image => <article key={image.id} className={ui.historyCard} data-saved-image-id={image.id}>
        <button className={ui.historyThumbnail} aria-label={`查看${image.brief}`} onClick={() => setPreview(image)}>
          <img src={image.src} alt={image.brief} loading="lazy" decoding="async" />
          <span title={image.brief}>{image.brief}</span>
        </button>
        <small>{image.cover ? '封面' : '配图'}{image.cover?.review.status === 'passed' ? ' · 已审核' : ''}</small>
        <div className={ui.historyActions}>
          <a href={image.src} download={`楷排${image.cover ? '封面' : '配图'}-${image.id}.${extension(image.src)}`}>下载</a>
          <button disabled={p.aiHasPendingPlan || p.aiPhase === 'running'} onClick={() => p.onInsertAiImage?.(image.src, image.brief)}>插入正文</button>
        </div>
        <button className={ui.historyEdit} onClick={() => onEdit(image.id)}>继续编辑画面要求</button>
        <button className={ui.historyDelete} disabled={!p.onDeleteSavedImage || p.aiImageHistoryLoading || Boolean(p.aiImageHistoryDeletingId)} onClick={() => confirmDelete(image)}>{p.aiImageHistoryDeletingId === image.id ? '正在删除…' : '删除'}</button>
      </article>)}
    </div>
    {p.aiImageHistoryError && <p role="alert">{p.aiImageHistoryError}</p>}
    {p.aiImageHistoryDeleteError && <p role="alert">{p.aiImageHistoryDeleteError}</p>}
    {p.aiImageHistoryHasMore && <button className={ui.primary} disabled={p.aiImageHistoryLoading || Boolean(p.aiImageHistoryDeletingId)} onClick={() => p.onLoadMoreSavedImages?.()}>{p.aiImageHistoryLoading ? '正在加载图片…' : p.aiImageHistoryError ? '重试加载' : '加载更多（12 张）'}</button>}
    {!p.aiImageHistoryLoading && !p.aiImageHistoryHasMore && <p role="status">{images.length ? '已显示全部历史图片' : '还没有保存的图片'}</p>}
    {p.aiHasPendingPlan && <p>应用或放弃当前排版方案后，即可插入历史图片。</p>}
    {preview && <HistoryPreview image={preview} onClose={() => setPreview(null)} />}
  </details>;
}

function HistoryPreview({ image, onClose }: { image: SavedImage; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    close.current?.focus();
    return () => previous?.focus();
  }, []);
  return createPortal(<div className={ui.coverLightbox} role="dialog" aria-modal="true" aria-label="历史图片大图"
    onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') { event.preventDefault(); close.current?.focus(); }
    }}>
    <section><div><span>{image.brief}</span><button ref={close} onClick={onClose}>关闭大图</button></div><img src={image.src} alt={image.brief} /></section>
  </div>, document.body);
}
