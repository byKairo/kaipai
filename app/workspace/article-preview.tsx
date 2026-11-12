'use client';

import { memo, useEffect, useMemo, useState, useSyncExternalStore, type RefObject, type UIEventHandler } from 'react';
import { markdownToWechat, type WechatReadingOptions } from '../../lib/wechat-html';

// Match the workspace breakpoint that hides the preview in the other mobile panes.
const mobileLayoutQuery = '(max-width: 899px)';
const previewIdleMs = 180;
const isMobileLayout = () => window.matchMedia(mobileLayoutQuery).matches;
const serverIsMobileLayout = () => false;

function subscribeToMobileLayout(notify: () => void) {
  const media = window.matchMedia(mobileLayoutQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
}

type Props = {
  opening: boolean;
  mobilePreviewSelected: boolean;
  styleId: string;
  headingStyle: string;
  variant: string;
  paperMode: 'follow' | 'style' | 'custom';
  background: string | undefined;
  markdown: string;
  accent: string;
  marker: string;
  sidePadding: number;
  eyebrow: string;
  reading: WechatReadingOptions;
  proposal?: { html: string; styleId: string };
  scrollRef: RefObject<HTMLDivElement>;
  onScroll: UIEventHandler<HTMLDivElement>;
};

export const ArticlePreview = memo(function ArticlePreview({ opening, mobilePreviewSelected, styleId, headingStyle, variant, paperMode, background, markdown, accent, marker, sidePadding, eyebrow, reading, proposal, scrollRef, onScroll }: Props) {
  const mobile = useSyncExternalStore(subscribeToMobileLayout, isMobileLayout, serverIsMobileLayout);
  const visible = !mobile || mobilePreviewSelected;
  const appearance = useMemo(() => ({ styleId, headingStyle, variant, paperMode, background, accent, marker, sidePadding, eyebrow, reading }), [styleId, headingStyle, variant, paperMode, background, accent, marker, sidePadding, eyebrow, reading]);
  const snapshot = useMemo(() => ({ markdown, appearance }), [markdown, appearance]);
  const [preview, setPreview] = useState(() => ({ visible, rendered: visible ? snapshot : null }));
  const { rendered } = preview;
  // Reopening or changing styles uses the latest text immediately. Keeping the
  // last render while hidden also keeps the preview pane and its scroll position.
  const refreshNow = visible && (rendered?.appearance !== appearance || (opening && rendered !== snapshot));
  if (visible !== preview.visible || refreshNow) {
    setPreview({ visible, rendered: visible ? snapshot : rendered });
  }
  useEffect(() => {
    if (!visible || preview.rendered === snapshot) return;
    const timer = window.setTimeout(() => {
      setPreview(current => current === preview ? { visible, rendered: snapshot } : current);
    }, previewIdleMs);
    return () => window.clearTimeout(timer);
  }, [visible, preview, snapshot]);
  const html = useMemo(() => {
    if (!rendered) return '';
    const { styleId, accent, marker, sidePadding, eyebrow, reading } = rendered.appearance;
    return markdownToWechat(rendered.markdown, accent, marker, styleId, sidePadding, eyebrow, reading);
  }, [rendered]);
  const displayed = rendered?.appearance ?? appearance;
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => { setShowOriginal(false); }, [proposal?.html]);
  const proposed = proposal && !showOriginal;
  const bodyHtml = proposed ? proposal.html : html;
  const bodyMarkup = useMemo(() => ({ __html: bodyHtml }), [bodyHtml]);
  return <section className={`v091-pane v091-preview style-${proposed ? proposal.styleId : displayed.styleId} heading-${displayed.headingStyle} variant-${displayed.variant}`} data-paper-mode={displayed.paperMode} aria-busy={visible && snapshot !== rendered}>
    <header><span className="v091-preview-traffic" aria-hidden="true"><i /><i /><i /></span><b><span className="v091-preview-dir">&gt; DIR</span> / 预览</b></header>
    {proposal && <div className="ai-preview-review" aria-label="排版效果对照"><span>建议版尚未应用</span><div role="group" aria-label="切换预览版本"><button aria-pressed={showOriginal} onClick={() => setShowOriginal(true)}>原文</button><button aria-pressed={!showOriginal} onClick={() => setShowOriginal(false)}>建议版</button></div></div>}
    <div className="v091-preview-bg" ref={scrollRef} onScroll={onScroll}>
      <div className="v091-wechat-phone" style={{ background: proposed ? undefined : displayed.background }}>
        <div className="v091-wechat-article" dangerouslySetInnerHTML={bodyMarkup} />
      </div>
    </div>
  </section>;
});
