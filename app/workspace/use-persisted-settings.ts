'use client';

import { useCallback, useEffect, useRef } from 'react';
import { safeLocalStorage } from '../../lib/browser-storage';

/** Keep the existing storage keys, coalesce slider changes, and flush on page exit. */
export function usePersistedSettings(values: Record<string, string>, ready: boolean, onError: () => void) {
  const latest = useRef({ values, ready });
  latest.current = { values, ready };
  const errorCallback = useRef(onError);
  errorCallback.current = onError;
  const saved = useRef(new Map<string, string>());
  const warned = useRef(false);
  const flush = useCallback(() => {
    if (!latest.current.ready) return;
    let failed = false;
    for (const [key, value] of Object.entries(latest.current.values)) {
      if (saved.current.get(key) === value) continue;
      if (safeLocalStorage.getItem(key) === value || safeLocalStorage.setItem(key, value)) saved.current.set(key, value);
      else failed = true;
    }
    if (failed && !warned.current) errorCallback.current();
    warned.current = failed;
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(flush, 180);
    return () => window.clearTimeout(timer);
  }, [values, ready, flush]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', hidden);
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', hidden); flush(); };
  }, [flush]);
}
