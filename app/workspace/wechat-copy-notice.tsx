'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicationImage } from '../../lib/wechat-publication';
import { prepareArticleCopy } from '../../lib/article-copy-assets';
import { uploadArticleAsset } from '../../lib/article-asset-client';
import { readResponseJson } from '../../lib/response-body';
import { AiRevisionDialog } from './ai-revision-dialog';
import ui from './wechat-copy-notice.module.css';

export type WechatCopyDetails = { html: string; images: PublicationImage[]; signal: AbortSignal; isCurrent: () => boolean };
type DownloadResult = { count?: number; failed?: number; error?: string };
type Turnstile = { render(node: HTMLElement, options: Record<string, unknown>): string; remove(id: string): void };
const turnstile = () => (window as Window & { turnstile?: Turnstile }).turnstile;
let scriptPromise: Promise<Turnstile> | undefined;
function loadVerification() {
  if (turnstile()) return Promise.resolve(turnstile()!);
  if (!scriptPromise) scriptPromise = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => { window.clearTimeout(timer); script.remove(); scriptPromise = undefined; reject(new Error('图片上传验证加载失败，请重试')); };
    const timer = window.setTimeout(fail, 15000);
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => { window.clearTimeout(timer); if (turnstile()) resolve(turnstile()!); else fail(); };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function WechatCopyNotice({ details, onClose, onDownload, onReady }: {
  details: WechatCopyDetails;
  onClose: () => void;
  onDownload: (images: PublicationImage[]) => Promise<DownloadResult>;
  onReady: (html: string) => Promise<boolean>;
}) {
  const verificationHost = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onClose }); callbacks.current = { onReady, onClose };
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState('正在准备文章图片…');
  const [error, setError] = useState('');
  const [ready, setReady] = useState('');
  const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const abort = () => { controller.abort(); setError('文章已更改，请关闭后重新复制'); };
    details.signal.addEventListener('abort', abort, { once: true });
    let widget: string | undefined, api: Turnstile | undefined, started = false;
    const current = () => !signal.aborted && details.isCurrent();
    const failure = (reason: unknown) => { if (current()) setError(reason instanceof Error ? reason.message : '图片准备失败，请重试'); };
    async function prepare(token: string) {
      if (!current() || started) return;
      started = true;
      try {
        setMessage('正在转存文章图片，请稍候…');
        const session = await fetch('/api/article-assets/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal });
        const result = await readResponseJson(session, 32768);
        if (!session.ok) throw new Error(result.error || '图片上传验证未通过，请重试');
        const html = await prepareArticleCopy(details.html, location.origin, source => uploadArticleAsset(source, signal), signal, (done, total) => {
          if (current()) setMessage(`正在准备图片 ${done}/${total}…`);
        });
        if (!current()) return;
        setReady(html); setMessage('图片已准备好，原来的位置、图注和样式均已保留。');
        if (await callbacks.current.onReady(html)) callbacks.current.onClose();
      } catch (reason) { failure(reason); }
    }
    void (async () => {
      try {
        setError(''); setReady(''); setMessage('正在准备文章图片…');
        if (!current()) return;
        const response = await fetch('/api/article-assets', { cache: 'no-store', signal });
        const config = await readResponseJson(response, 32768);
        if (!response.ok || !config.enabled || !config.siteKey) throw new Error('图片存储尚未接通，暂时无法复制完整图文；原文和图片未改变');
        api = await loadVerification();
        if (!current() || !verificationHost.current) return;
        setMessage('正在验证图片上传，请稍候…');
        widget = api.render(verificationHost.current, {
          sitekey: config.siteKey, action: 'article-images', size: 'flexible', appearance: 'interaction-only',
          callback: (token: string) => void prepare(token),
          'error-callback': () => failure(new Error('图片上传验证失败，请重试')),
          'expired-callback': () => { if (!started) failure(new Error('图片上传验证已过期，请重试')); },
        });
      } catch (reason) { failure(reason); }
    })();
    return () => { controller.abort(); details.signal.removeEventListener('abort', abort); if (widget && api) api.remove(widget); };
  }, [details, attempt]);
  async function download() {
    setDownloading(true);
    try {
      const result = await onDownload(details.images);
      setMessage(result.error || (result.failed ? `已下载 ${result.count} 张，${result.failed} 张失败，请查看包内说明。` : `已下载 ${result.count} 张图片作为备用。`));
    } catch { setMessage('图片包下载失败，请重试'); }
    finally { setDownloading(false); }
  }
  return <AiRevisionDialog label="准备图文复制" onClose={onClose}>
    <section className={ui.content}>
      <div className={ui.head}><h2>{error ? '图文尚未复制' : ready ? '图文已准备好' : '准备图文复制'}</h2><button aria-label="关闭图文复制" onClick={onClose}>×</button></div>
      <p role="status">{message}</p>
      <div ref={verificationHost} />
      {error && <p role="alert">{error}</p>}
      <p className={ui.note}>仅在复制时转存图片，原稿保持不变。粘贴后请在公众号后台保存并预览，检查图片转存结果。</p>
      <div className={ui.actions}>
        {ready && <button onClick={() => void onReady(ready).then(copied => { if (copied) onClose(); })}>复制完整图文</button>}
        {error && <><button onClick={() => setAttempt(value => value + 1)}>重新准备图片</button><button disabled={downloading} onClick={() => void download()}>{downloading ? '正在准备图片包…' : '下载图片包备用'}</button></>}
      </div>
    </section>
  </AiRevisionDialog>;
}
