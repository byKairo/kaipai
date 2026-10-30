'use client';

import { memo, useDeferredValue, useEffect, useMemo, useState, type RefObject, type UIEventHandler } from 'react';
import { markdownToWechat, type WechatReadingOptions } from '../../lib/wechat-html';

type Props = {
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

/** Preview redraws only when article output or its presentation changes. */
export const ArticlePreview = memo(function ArticlePreview({ styleId, headingStyle, variant, paperMode, background, markdown, accent, marker, sidePadding, eyebrow, reading, proposal, scrollRef, onScroll }: Props) {
  const snapshot = useMemo(() => ({ styleId, headingStyle, variant, paperMode, background, markdown, accent, marker, sidePadding, eyebrow, reading }), [styleId, headingStyle, variant, paperMode, background, markdown, accent, marker, sidePadding, eyebrow, reading]);
  // Urgent typing can commit with the previous preview; export always renders current input.
  const deferred = useDeferredValue(snapshot);
  const html = useMemo(() => markdownToWechat(deferred.markdown, deferred.accent, deferred.marker, deferred.styleId, deferred.sidePadding, deferred.eyebrow, deferred.reading), [deferred]);
  const [showOriginal, setShowOriginal] = useState(false);
  useEffect(() => { setShowOriginal(false); }, [proposal?.html]);
  const proposed = proposal && !showOriginal;
  return <section className={`v091-pane v091-preview style-${proposed ? proposal.styleId : deferred.styleId} heading-${deferred.headingStyle} variant-${deferred.variant}`} data-paper-mode={deferred.paperMode} aria-busy={snapshot !== deferred}>
    <header><span className="v091-preview-traffic" aria-hidden="true"><i /><i /><i /></span><b><span className="v091-preview-dir">&gt; DIR</span> / 预览</b></header>
    {proposal && <div className="ai-preview-review" aria-label="排版效果对照"><span>建议版尚未应用</span><div role="group" aria-label="切换预览版本"><button aria-pressed={showOriginal} onClick={() => setShowOriginal(true)}>原文</button><button aria-pressed={!showOriginal} onClick={() => setShowOriginal(false)}>建议版</button></div></div>}
    <div className="v091-preview-bg" ref={scrollRef} onScroll={onScroll}>
      <div className="v091-wechat-phone" style={{ background: proposed ? undefined : deferred.background }}>
        <div className="v091-wechat-article" dangerouslySetInnerHTML={{ __html: proposed ? proposal.html : html }} />
      </div>
    </div>
  </section>;
});
