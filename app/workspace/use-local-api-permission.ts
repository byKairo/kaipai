'use client';

import { useEffect, useState } from 'react';
import { localPermissionStatus } from '../../lib/local-api-access';

/** Observe browser grants; never change permissions or contact a local service. */
export function useLocalApiPermission(local: boolean) {
  const [state, setState] = useState<PermissionState | 'unsupported'>('unsupported');
  useEffect(() => {
    setState('unsupported');
    if (!local) return;
    let alive = true;
    let status: PermissionStatus | null = null;
    const changed = () => { if (alive) setState(status?.state || 'unsupported'); };
    const check = async () => {
      const current = await localPermissionStatus();
      if (!alive) return;
      status?.removeEventListener('change', changed);
      status = current;
      changed();
      status?.addEventListener('change', changed);
    };
    void check();
    window.addEventListener('focus', check);
    return () => { alive = false; status?.removeEventListener('change', changed); window.removeEventListener('focus', check); };
  }, [local]);
  return state;
}
