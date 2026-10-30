'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import css from './responsive-actions.module.css';

export function ResponsiveActions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const mobile = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!mobile.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  return <>
    <div className={css.desktop}>{children}</div>
    <div ref={mobile} className={css.mobile} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } }} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <button ref={trigger} type="button" className="v091-btn" aria-expanded={open} aria-controls="mobile-article-actions" onClick={() => setOpen(value => !value)}>更多 ▾</button>
      {open && <div id="mobile-article-actions" className={css.menu} aria-label="更多文章操作" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  </>;
}
