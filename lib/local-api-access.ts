import { readResponseText } from './response-body';

/** Browser-only loopback access. No key, endpoint or probe is sent to the public server. */
export type LoopbackRequestInit = RequestInit & { targetAddressSpace?: 'loopback' };
const isLoopback = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
export const loopbackOptions = (init: RequestInit): LoopbackRequestInit => ({ ...init, targetAddressSpace: 'loopback' });

export async function localPermissionStatus(): Promise<PermissionStatus | null> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) return null;
  for (const name of ['loopback-network', 'local-network-access']) {
    try { return await navigator.permissions.query({ name } as unknown as PermissionDescriptor); }
    catch { /* Older browsers do not implement these permissions. */ }
  }
  return null;
}

export async function localPermissionState(): Promise<'granted' | 'prompt' | 'denied' | 'unsupported'> {
  return (await localPermissionStatus())?.state || 'unsupported';
}

/** CLIProxyAPI explicitly supports X-Api-Key. Its wildcard CORS header does
 * not authorize Authorization in browsers, so identify it without credentials
 * before any model request. Never retry a possibly billed POST with another key header. */
export async function localAuthHeader(baseUrl: string, signal: AbortSignal): Promise<'Authorization' | 'X-Api-Key'> {
  const url = new URL(baseUrl);
  if (!isLoopback(url)) throw new Error('本机连接仅用于 localhost、127.0.0.1 或 [::1]');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener('abort', cancel, { once: true });
  if (signal.aborted) cancel();
  // The first request can be paused by Chrome's permission prompt. Do not
  // abandon identification after 1.5 seconds and incorrectly switch back to
  // Bearer while the user is still deciding whether to allow loopback access.
  const permission = await localPermissionState();
  const timer = setTimeout(cancel, permission === 'prompt' ? 15000 : 1500);
  try {
    const response = await fetch(new URL('/', url).href, loopbackOptions({ signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'manual' }));
    if (!response.ok || !response.headers.get('content-type')?.includes('json')) return 'Authorization';
    const text = await readResponseText(response, 4096);
    const data = JSON.parse(text);
    return data?.message === 'CLI Proxy API Server' && Array.isArray(data.endpoints) && data.endpoints.includes('GET /v1/models') ? 'X-Api-Key' : 'Authorization';
  } catch (error) {
    if (signal.aborted) throw error;
    return 'Authorization';
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
}

export async function localConnectionFailure(): Promise<Error> {
  if (await localPermissionState() === 'denied') return new Error('浏览器已禁止楷排访问本机 API。请点击地址栏左侧的网站设置，将“本机应用”或“本机网络访问”设为允许，刷新页面后重试。正式域名与备用入口需要分别授权。');
  return new Error('未能连接本机 API。请确认地址和端口、服务运行状态，以及接口是否允许当前网站跨域访问；浏览器询问本机网络访问时请选择允许。');
}
