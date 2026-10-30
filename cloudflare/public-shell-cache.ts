/** Edge cache for the audited anonymous home shell, never API or user data. */
export type ShellCache = Pick<Cache, 'match' | 'put'>;
export type ShellContext = { waitUntil(promise: Promise<unknown>): void };

const ttl = 60;
const bypassHeaders = [
  'cookie', 'authorization', 'range', 'if-match', 'if-none-match', 'if-modified-since',
  'if-unmodified-since', 'if-range', 'next-action', 'x-rsc-action', 'rsc',
  'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch',
  'next-url', 'x-middleware-prefetch',
  'x-forwarded-host', 'x-original-url', 'x-rewrite-url', 'x-middleware-rewrite',
  'x-middleware-subrequest', 'x-middleware-invoke', 'x-middleware-override-headers',
];
const safeVary = new Set(['accept-encoding', 'rsc', 'next-router-state-tree',
  'next-router-prefetch', 'next-router-segment-prefetch', 'next-url',
  // These framework variants are safe only because all x-vinext-* requests bypass.
  'x-vinext-interception-context', 'x-vinext-interception-id', 'x-vinext-mounted-slots',
  'x-vinext-rsc-render-mode', 'x-vinext-rsc-state-fingerprint']);

export function isPublicShellRequest(request: Request): boolean {
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname !== '/' || url.search) return false;
  if (bypassHeaders.some(name => request.headers.has(name))) return false;
  if (Array.from(request.headers.keys()).some(name => name.startsWith('x-vinext-') || name.startsWith('x-nextjs-'))) return false;
  if (/no-cache|no-store|max-age\s*=\s*0/i.test(request.headers.get('cache-control') || '') || request.headers.has('pragma')) return false;
  const accept = request.headers.get('accept') || '*/*';
  return !accept.includes('text/x-component') && (accept.includes('text/html') || accept.includes('*/*'));
}

export function canStoreShell(response: Response): boolean {
  if (response.status !== 200 || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '')) return false;
  if (response.headers.has('set-cookie') || response.headers.has('location')) return false;
  // A future authenticated page or nonce-based CSP must not inherit this policy.
  if (/\bprivate\b/i.test(response.headers.get('cache-control') || '')) return false;
  if (/nonce-/i.test(response.headers.get('content-security-policy') || '')) return false;
  return (response.headers.get('vary') || '').split(',').every(name => !name.trim() || safeVary.has(name.trim().toLowerCase()));
}

export function shellCacheKey(request: Request, release: string): Request {
  const url = new URL(request.url);
  url.pathname = '/__kaipai_public_shell/' + encodeURIComponent(release);
  url.search = '';
  return new Request(url, { method: 'GET' });
}

function outgoing(response: Response, status: 'HIT' | 'MISS'): Response {
  const headers = new Headers(response.headers);
  // Browser validation avoids stale HTML pointing at a previous release's chunks.
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  headers.set('X-Kaipai-Shell-Cache', status);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function uncachedHome(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  // Provider-specific policy headers take precedence over Cache-Control.
  for (const name of ['CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control', 'Surrogate-Control', 'Expires']) headers.delete(name);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function cachedPublicShell(
  request: Request, render: () => Promise<Response>, cache: ShellCache | undefined,
  context: ShellContext, release: string,
): Promise<Response> {
  if (!isPublicShellRequest(request)) {
    const response = await render();
    // Framework static eligibility can still emit a long public TTL for a
    // cookie/query/RSC request. Keep those variants out of downstream caches.
    return new URL(request.url).pathname === '/' ? uncachedHome(response) : response;
  }
  if (!cache) return render();
  const key = shellCacheKey(request, release);
  try {
    const hit = await cache.match(key);
    if (hit) return outgoing(hit, 'HIT');
  } catch { /* An unavailable edge cache must not take the site down. */ }
  const response = await render();
  if (!canStoreShell(response)) return uncachedHome(response);
  const stored = response.clone();
  const headers = new Headers(stored.headers);
  // This is an explicit override only for the public, data-free GET / shell.
  // Cache API does not implement stale-while-revalidate; expire after 60 seconds.
  headers.set('Cache-Control', `public, max-age=${ttl}`);
  headers.delete('expires');
  const cached = new Response(stored.body, { status: 200, headers });
  context.waitUntil(cache.put(key, cached).catch(() => undefined));
  return outgoing(response, 'MISS');
}
