'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { RichEditorProps } from './rich-editor';
import ui from './deferred-rich-editor.module.css';

let editorModule: Promise<typeof import('./rich-editor')> | undefined;
function loadEditor() {
  return editorModule ??= import('./rich-editor').catch(error => { editorModule = undefined; throw error; });
}

export default function DeferredRichEditor(props: RichEditorProps) {
  const [EditorComponent, setEditorComponent] = useState<typeof import('./rich-editor')['default'] | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadTiming, setLoadTiming] = useState<string>();
  useEffect(() => {
    let current = true;
    void loadEditor().then(module => { if (current) setEditorComponent(() => module.default); }, () => { if (current) setFailed(true); });
    return () => { current = false; };
  }, []);
  // Local performance evidence only; no telemetry or document data leaves the browser.
  useEffect(() => {
    if (!ready) return;
    if (!performance.getEntriesByName('kaipai-editor-ready').length) performance.mark('kaipai-editor-ready');
    // Expose timings in the DOM for read-only diagnostics; never upload them.
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    setLoadTiming(JSON.stringify({
      firstContentfulPaintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
      editorReadyMs: performance.getEntriesByName('kaipai-editor-ready')[0].startTime,
      ttfbMs: navigation?.responseStart, documentEndMs: navigation?.responseEnd, workerStartMs: navigation?.workerStart,
      resources: (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        .filter(entry => new URL(entry.name).pathname.startsWith('/_next/static/'))
        .map(entry => ({ path: new URL(entry.name).pathname, startMs: entry.startTime, endMs: entry.responseEnd, transferredBytes: entry.transferSize, encodedBytes: entry.encodedBodySize })),
    }));
  }, [ready]);
  const onReady = useCallback((editor: Editor | null) => {
    setReady(Boolean(editor));
    props.onReady(editor);
  }, [props.onReady]);
  return <div className={ui.host} data-load-timing={loadTiming}>
    {EditorComponent && <EditorComponent {...props} onReady={onReady} />}
    {!ready && <div className={ui.preview}>
      <div role="status">{failed ? <>编辑器暂时未能加载。<button type="button" onClick={() => window.location.reload()}>重新加载页面</button></> : '正在加载编辑器，已保存的文稿不会被改写。'}</div>
      <textarea readOnly aria-label="正文预览，编辑器加载中" value={props.value} />
    </div>}
  </div>;
}
