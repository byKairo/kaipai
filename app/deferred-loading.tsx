'use client';

import type { DynamicOptionsLoadingProps } from 'next/dynamic';

export function DeferredLoading({ error, retry }: DynamicOptionsLoadingProps) {
  return <div className="side-body" role="status" aria-live="polite">
    {error ? <><p>功能加载失败，请重试。</p><button className="v091-btn" onClick={retry}>重新加载</button></> : <p>正在加载…</p>}
  </div>;
}
