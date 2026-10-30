'use client';

import { useEffect, useRef, useState } from 'react';

export default function OfflineStatus({ editorReady }: { editorReady: boolean }) {
  const [phase, setPhase] = useState<'none' | 'ready' | 'update'>('none');
  const registrationRef = useRef<ServiceWorkerRegistration>();
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
        registrationRef.current = registration;
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
  useEffect(() => {
    if (phase === 'none') return;
    let alive = true;
    let lastInput = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    let idle: number | undefined;
    let channel: MessageChannel | undefined;
    const touched = () => { lastInput = Date.now(); };
    const schedule = () => { if (alive) timer = setTimeout(check, 5000); };
    const warm = () => {
      if (!alive) return;
      if (document.visibilityState !== 'visible' || Date.now() - lastInput < 4000) return schedule();
      const registration = registrationRef.current;
      const worker = registration?.waiting || registration?.active;
      if (!worker) return;
      channel = new MessageChannel();
      // Older active workers may not understand this message; stop quietly.
      timer = setTimeout(() => channel?.port1.close(), 15000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        channel?.port1.close();
        if (event.data?.remaining > 0 && !event.data?.failed) schedule();
      };
      worker.postMessage({ type: 'KAIPAI_CACHE_NEXT' }, [channel.port2]);
    };
    const check = () => {
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      if (!navigator.onLine || document.visibilityState !== 'visible' || connection?.saveData ||
        /^(slow-)?2g$/.test(connection?.effectiveType || '') || Date.now() - lastInput < 4000) return schedule();
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(warm);
      else warm();
    };
    window.addEventListener('pointerdown', touched, { passive: true });
    window.addEventListener('keydown', touched, { passive: true });
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      channel?.port1.close();
      window.removeEventListener('pointerdown', touched);
      window.removeEventListener('keydown', touched);
    };
  }, [phase]);
  if (phase === 'none') return null;
  return <span role="status" title={phase === 'update' ? '新版基础工作台已准备好，关闭所有楷排页面后重新打开即可更新。' : '基础工作台已缓存，其他功能在使用时或空闲时逐步缓存；AI 仍需要网络。'}>{phase === 'update' ? '新版已准备好' : '下次可快速打开'}</span>;
}
