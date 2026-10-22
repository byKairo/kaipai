/** Cloudflare-only abuse guard. No API keys, articles or persistent visitor records. */
export interface ApiRateLimiter { limit(input: { key: string }): Promise<{ success: boolean }> }
export async function limitApiRequest(request: Request, limiter: ApiRateLimiter): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (request.method !== 'POST' || !(pathname === '/api/ai' || pathname.startsWith('/api/ai/') || pathname === '/api/credentials/seal')) return null;
  // At the public Worker edge this header is supplied by Cloudflare, not X-Forwarded-For.
  const address = request.headers.get('cf-connecting-ip');
  if (!address) return null; // Local previews lack an edge client address.
  const day = Math.floor(Date.now() / 86400000);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kaipai-api:${day}:${address}`));
  const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  try {
    if ((await limiter.limit({ key })).success) return null;
  } catch {
    // A platform limiter outage must not disable otherwise-valid saved configurations.
    return null;
  }
  return new Response(JSON.stringify({ ok: false, error: '请求过于频繁，请稍等一分钟后重试。' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store, private', 'Retry-After': '60', 'X-Content-Type-Options': 'nosniff' },
  });
}
