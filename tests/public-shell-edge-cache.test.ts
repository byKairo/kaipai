import assert from 'node:assert/strict';
import { cachedPublicShell, shellCacheKey, type ShellCache } from '../cloudflare/public-shell-cache';
const { createReleaseId } = require('../scripts/verify-cloudflare-build.cjs') as { createReleaseId(source: string): string };

export async function run() {
  const sameSourceBuildA = createReleaseId('same-source-digest');
  const sameSourceBuildB = createReleaseId('same-source-digest');
  assert.notEqual(sameSourceBuildA, sameSourceBuildB, 'identical-source rebuilds need distinct cache namespaces');
  assert.notEqual(shellCacheKey(new Request('https://kaipai.example/'), sameSourceBuildA).url,
    shellCacheKey(new Request('https://kaipai.example/'), sameSourceBuildB).url);
  const entries = new Map<string, Response>();
  let reads = 0;
  let renders = 0;
  const pending: Promise<unknown>[] = [];
  const cache: ShellCache = {
    async match(key) { reads++; return entries.get((key as Request).url)?.clone(); },
    async put(key, value) { entries.set((key as Request).url, value.clone()); },
  };
  const context = { waitUntil(value: Promise<unknown>) { pending.push(value); } };
  const home = (path = '/', headers: Record<string, string> = {}, method = 'GET') => new Request('https://kaipai.example' + path, { method, headers: { accept: 'text/html', ...headers } });
  const render = async () => {
    renders++;
    return new Response('<html>public shell</html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, must-revalidate', Vary: 'RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Url, X-Vinext-Interception-Context, X-Vinext-Interception-Id, X-Vinext-Mounted-Slots, X-Vinext-Rsc-Render-Mode, X-Vinext-Rsc-State-Fingerprint' } });
  };
  const first = await cachedPublicShell(home(), render, cache, context, 'release-a');
  await Promise.all(pending);
  assert.equal(first.headers.get('x-kaipai-shell-cache'), 'MISS');
  assert.equal(first.headers.get('cache-control'), 'public, max-age=0, must-revalidate');
  assert.equal(await first.text(), '<html>public shell</html>');
  const second = await cachedPublicShell(home(), render, cache, context, 'release-a');
  assert.equal(second.headers.get('x-kaipai-shell-cache'), 'HIT');
  assert.equal(await second.text(), '<html>public shell</html>');
  assert.equal(renders, 1, 'a cache hit must skip page generation');
  assert.equal(Array.from(entries.values())[0].headers.get('cache-control'), 'public, max-age=60');
  await cachedPublicShell(home(), render, cache, context, 'release-b');
  assert.equal(renders, 2, 'new release must not serve old HTML/chunk URLs');
  await cachedPublicShell(new Request('https://other.example/', { headers: { accept: 'text/html' } }), render, cache, context, 'release-a');
  assert.equal(renders, 3, 'origins must not share rendered shell URLs');

  const bypass = [
    home('/api/ai'), home('/?article=private'), home('/', {}, 'POST'), home('/', {}, 'HEAD'),
    ...['cookie', 'authorization', 'rsc', 'next-action', 'x-rsc-action', 'next-url', 'next-router-state-tree',
      'next-router-prefetch', 'next-router-segment-prefetch', 'x-middleware-prefetch', 'x-vinext-cacheability-probe',
      'x-vinext-interception-context', 'x-vinext-interception-id', 'x-vinext-mounted-slots',
      'x-vinext-rsc-render-mode', 'x-vinext-rsc-state-fingerprint', 'x-forwarded-host',
      'x-middleware-rewrite', 'x-nextjs-data', 'range', 'if-none-match', 'if-modified-since', 'pragma'].map(name => home('/', { [name]: '1' })),
    home('/', { accept: 'text/x-component' }), home('/', { 'cache-control': 'no-cache' }),
  ];
  const readsBefore = reads;
  for (const request of bypass) {
    const response = await cachedPublicShell(request, render, cache, context, 'release-a');
    assert.equal(response.headers.get('x-kaipai-shell-cache'), null);
    assert.match(response.headers.get('cache-control')!, /no-store/);
  }
  assert.equal(reads, readsBefore, 'private/protocol requests must not read cached public HTML');

  const publicUpstream = async () => new Response('framework response', { headers: {
    'content-type': 'text/html', 'cache-control': 's-maxage=31536000, stale-while-revalidate',
    'cdn-cache-control': 'max-age=31536000', 'cloudflare-cdn-cache-control': 'max-age=31536000',
    'surrogate-control': 'max-age=31536000', expires: 'Thu, 01 Jan 2099 00:00:00 GMT',
  } });
  for (const request of bypass.filter(request => new URL(request.url).pathname === '/')) {
    const response = await cachedPublicShell(request, publicUpstream, cache, context, 'release-a');
    assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0, must-revalidate');
    for (const name of ['cdn-cache-control', 'cloudflare-cdn-cache-control', 'surrogate-control', 'expires']) assert.equal(response.headers.get(name), null);
  }
  const apiResponse = await cachedPublicShell(home('/api/ai'), publicUpstream, cache, context, 'release-a');
  assert.equal(apiResponse.headers.get('cache-control'), 's-maxage=31536000, stale-while-revalidate', 'API response policy remains the API handler responsibility');

  const unsafeResponses: Record<string, string>[] = [
    { 'set-cookie': 'session=private' }, { 'cache-control': 'private, no-store' },
    { vary: '*' }, { vary: 'Cookie' }, { vary: 'Accept-Language' },
    { 'content-type': 'text/x-component' }, { 'content-security-policy': "script-src 'nonce-secret'" },
  ];
  for (const headers of unsafeResponses) {
    const freshEntries = new Map<string, Response>();
    const privateCache: ShellCache = { async match() { return undefined; }, async put(key, response) { freshEntries.set((key as Request).url, response); } };
    const response = await cachedPublicShell(home(), async () => new Response('sensitive', { headers: { 'content-type': 'text/html', ...headers } }), privateCache, context, 'private');
    assert.equal(response.headers.get('x-kaipai-shell-cache'), null);
    assert.equal(freshEntries.size, 0, JSON.stringify(headers));
  }
  const broken: ShellCache = { async match() { throw new Error('cache unavailable'); }, async put() { throw new Error('quota'); } };
  assert.equal(await (await cachedPublicShell(home(), render, broken, context, 'release-a')).text(), '<html>public shell</html>');
  await Promise.all(pending);
  console.log('Public shell edge cache: release/origin isolation, private request bypass, response admission, failure fallback passed.');
}
