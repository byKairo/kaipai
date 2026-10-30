import vinext from 'vinext/server/fetch-handler';
import { limitApiRequest, type ApiRateLimiter } from './lib/server/rate-limit';
import { cachedPublicShell, type ShellCache, type ShellContext } from './public-shell-cache';
import { release, sourceCommit } from './public-shell-release';
import { preloadEditor } from './editor-preload';
export * from 'vinext/server/fetch-handler';

function protect(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'self'" })) if (!headers.has(name)) headers.set(name, value);
  headers.delete('x-powered-by');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
export default {
  ...vinext,
  async fetch(request: Request, env: { KAIPAI_API_RATE_LIMITER: ApiRateLimiter }, context: ShellContext) {
    if (request.method === 'GET' && new URL(request.url).pathname === '/api/release') {
      return protect(Response.json({ commit: sourceCommit, channel: sourceCommit ? 'github-main' : 'local-preview' }, { headers: { 'Cache-Control': 'no-store, private' } }));
    }
    const blocked = await limitApiRequest(request, env.KAIPAI_API_RATE_LIMITER);
    if (blocked) return protect(blocked);
    const cache = (globalThis.caches as CacheStorage & { default?: ShellCache } | undefined)?.default;
    return protect(await cachedPublicShell(request, async () => preloadEditor(request, await vinext.fetch(request, env, context)), cache, context, release));
  },
};
