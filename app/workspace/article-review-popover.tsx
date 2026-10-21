'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import type { ReviewItem } from '../../lib/article-review';
import ui from './article-review.module.css';

export function ArticleReviewPopover({ editor, item, onAdopt, onIgnore, onClose }: {
  editor: Editor | null; item: ReviewItem | null; onAdopt: () => void; onIgnore: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!editor || !item) { setPosition(null); return; }
    const update = () => {
      if (editor.isDestroyed || item.to > editor.state.doc.content.size) return;
      const start = editor.view.coordsAtPos(item.from), end = editor.view.coordsAtPos(item.to);
      const visible = editor.view.dom.closest('.v091-editor-scroll')?.getBoundingClientRect();
      if (visible && (end.bottom < visible.top || start.top > visible.bottom)) { setPosition(null); return; }
      const width = ref.current?.offsetWidth || Math.min(340, window.innerWidth - 24);
      const height = ref.current?.offsetHeight || 200;
      const below = Math.max(start.bottom, end.bottom) + 10;
      setPosition({ left: Math.max(12, Math.min(start.left, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(below + height < window.innerHeight - 12 ? below : start.top - height - 10, window.innerHeight - height - 12)) });
    };
    update(); window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [editor, item]);
  useEffect(() => {
    if (!item) return;
    const close = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (target && !ref.current?.contains(target) && !target.closest('[data-review-id]')) onClose();
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [item, onClose]);
  if (!item) return null;
  return createPortal(<div ref={ref} className={ui.popover} role="dialog" aria-label="文章建议" style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? 'visible' : 'hidden' }}>
    <div className={ui.head}><b>{item.kind === 'clarify' ? '这里需要你确认' : item.kind === 'emphasis' ? '这句可以强调' : '这句可以更清楚'}</b><button type="button" aria-label="关闭建议" onClick={onClose}>×</button></div>
    {item.kind === 'replace' && <p className={ui.proposal}>{item.replacement}</p>}
    {item.kind === 'emphasis' && <p className={ui.proposal}>{item.quote}</p>}
    <p className={ui.reason}>{item.reason}</p>
    <div className={ui.actions}><button type="button" onClick={onIgnore}>{item.kind === 'clarify' ? '知道了' : '忽略'}</button>{item.kind !== 'clarify' && <button type="button" onClick={onAdopt}>{item.kind === 'emphasis' ? item.presentation === 'highlight' ? '采用高亮' : '采用加粗' : '采用'}</button>}</div>
  </div>, document.body);
}
