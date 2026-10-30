export function isLocalApi(address: string) {
  try { return ['localhost', '127.0.0.1', '[::1]'].includes(new URL(address).hostname); } catch { return false; }
}
/** Local upstream requests run in the browser; cloud requests keep server forwarding. */
export async function aiFetch(path: string, init: RequestInit) {
  const body = typeof init.body === 'string' ? JSON.parse(init.body) : {};
  if (typeof window !== 'undefined' && isLocalApi(body.baseUrl || body.endpoint || '')) {
    const { localAiFetch } = await import('./local-ai-client');
    return localAiFetch(path, body, init.signal || undefined);
  }
  return fetch(path, init);
}
