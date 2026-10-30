'use client';

import { useEffect, useState } from 'react';

export default function OfflineStatus({ editorReady }: { editorReady: boolean }) {
  const [phase, setPhase] = useState<'none' | 'ready' | 'update'>('none');
  useEffect(() => {
    if (!editorReady || process.env.NEXT_PUBLIC_KAIPAI_OFFLINE !== '1' || !('serviceWorker' in navigator) || !window.isSecureContext) return;
    let alive = true;
    let registration: ServiceWorkerRegistration | undefined;
    const controlled = () => { if (alive && navigator.serviceWorker.controller) setPhase(registration?.waiting ? 'update' : 'ready'); };
    navigator.serviceWorker.addEventListener('controllerchange', controlled);
    controlled();
    const start = async () => {
      try {
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        if (!alive) return;
        controlled();
        registration.addEventListener('updatefound', () => {
          const worker = registration?.installing;
          worker?.addEventListener('statechange', () => {
            if (alive && worker.state === 'installed' && navigator.serviceWorker.controller) setPhase('update');
          });
        });
        void navigator.serviceWorker.ready.then(controlled);
      } catch { /* Cache setup is optional; ordinary editing and saved documents remain available. */ }
    };
    // Wait for usable editing, then leave a short quiet period before background setup.
    const timer = window.setTimeout(() => { void start(); }, 3000);
    return () => { alive = false; window.clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', controlled); };
  }, [editorReady]);
  if (phase === 'none') return null;
  return <span role="status" title={phase === 'update' ? '新版本已下载，关闭所有楷排页面后重新打开即可更新。' : '基础工作台已缓存；AI 和尚未下载的功能仍需要网络。'}>{phase === 'update' ? '新版已准备好' : '下次可快速打开'}</span>;
}
