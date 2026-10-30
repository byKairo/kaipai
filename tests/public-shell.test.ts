import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';

const origin = 'https://kaipai.test';
const main = '/_next/static/chunks/main.js', lazy = '/_next/static/chunks/lazy.js', later = '/_next/static/chunks/later.js';
const bytes = new Map([[main, 'export const release = 1;'], [lazy, 'export const optional = 1;'], [later, 'export const later = 1;']]);
const template = fs.readFileSync(path.resolve(__dirname, '../cloudflare/service-worker.js'), 'utf8');
type WorkerEvent = { request?: any; data?: unknown; ports?: Array<{ postMessage: (value: unknown) => void }>; waitUntil?: (promise: Promise<unknown>) => void; respondWith?: (promise: Promise<Response>) => void };
function harness(options: { invalidAsset?: boolean; invalidOptional?: boolean; twoOptional?: boolean; mixedShell?: boolean; cached404?: boolean } = {}) {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const stores = new Map<string, Map<string, Response>>([['kaipai-public-shell-old', new Map()], ['another-app', new Map()]]);
  stores.get('kaipai-public-shell-old')!.set(origin + '/', new Response('<html>old complete home</html>'));
  const calls: Request[] = [];
  let offline = false, claims = 0;
  const key = (request: any) => typeof request === 'string' ? request : request.url;
  const caches = {
    async delete(name: string) { return stores.delete(name); },
    async keys() { return Array.from(stores.keys()); },
    async open(name: string) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return { async match(request: any) { return store.get(key(request))?.clone(); }, async put(request: any, response: Response) { store.set(key(request), response.clone()); } };
    },
  };
  const fetcher = async (request: Request) => {
    if (offline) throw new Error('Connection unavailable');
    calls.push(request);
    const url = new URL(request.url);
    if (url.pathname === '/') return new Response(options.mixedShell ? '<html>another release</html>' : `<html><script src="${main}"></script></html>`, { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } });
    if (options.cached404 && request.cache !== 'reload') return new Response('Not found', { status: 404 });
    return new Response(options.invalidAsset || (options.invalidOptional && url.pathname === lazy) ? '<html>error</html>' : bytes.get(url.pathname), { headers: { 'Content-Type': 'application/javascript' } });
  };
  let source = template;
  for (const [token, value] of Object.entries({ __KAIPAI_RELEASE__: 'new', __KAIPAI_PRECACHE__: [main], __KAIPAI_OPTIONAL__: options.twoOptional ? [lazy, later] : [lazy], __KAIPAI_BOOTSTRAP__: [main], __KAIPAI_ALLOWED_ASSETS__: [main, lazy, later], __KAIPAI_ASSET_HASHES__: Object.fromEntries(Array.from(bytes).map(([file, body]) => [file, createHash('sha256').update(body).digest('hex')])) })) source = source.replace(token, JSON.stringify(value));
  vm.runInNewContext(source, { self: { location: { origin }, clients: { claim: async () => { claims++; } }, addEventListener: (name: string, fn: (event: WorkerEvent) => void) => listeners.set(name, fn) }, caches, fetch: fetcher, Request, Response, URL, AbortController, setTimeout, clearTimeout, crypto: webcrypto });
  const lifecycle = (name: string) => { let pending: Promise<unknown> | undefined; listeners.get(name)!({ waitUntil: promise => { pending = promise; } }); return pending!; };
  const get = (pathname: string, extra: Record<string, unknown> = {}) => {
    const request = { url: origin + pathname, method: 'GET', mode: 'navigate', headers: new Headers(), ...extra };
    let result: Promise<Response> | undefined;
    listeners.get('fetch')!({ request, respondWith: promise => { result = promise; } });
    return result;
  };
  const warm = async (type = 'KAIPAI_CACHE_NEXT') => {
    let pending: Promise<unknown> | undefined, reply: any;
    listeners.get('message')!({ data: { type }, ports: [{ postMessage: value => { reply = value; } }], waitUntil: promise => { pending = promise; } });
    await pending;
    return reply;
  };
  return { stores, calls, lifecycle, get, warm, offline: () => { offline = true; }, claims: () => claims };
}

export async function run() {
  const h = harness();
  await h.lifecycle('install');
  assert.ok(h.stores.has('kaipai-public-shell-old'), 'install leaves the previous complete release intact');
  const oldCache = h.stores.get('kaipai-public-shell-old')!;
  assert.equal(await oldCache.get(origin + '/')!.clone().text(), '<html>old complete home</html>', 'install must not replace an active old page');
  assert.equal(oldCache.has(origin + lazy), false, 'optional features do not block installation or trigger downloads');
  assert.ok(!h.calls.some(request => new URL(request.url).pathname === lazy));
  assert.match(await oldCache.get(origin + main)!.clone().text(), /release = 1/, 'verified core assets can still repair older shells');
  assert.equal(await h.warm('unrecognized'), undefined, 'unrecognized messages do not start downloads');
  assert.equal((await h.warm()).remaining, 0);
  assert.match(await oldCache.get(origin + lazy)!.clone().text(), /optional = 1/, 'idle work backfills a verified optional asset without replacing old HTML');
  assert.ok(h.calls.every(request => request.credentials === 'omit'), 'public cache setup does not request credentials');
  h.offline();
  assert.match(await (await h.get('/')!).text(), /main\.js/);
  assert.match(await (await h.get(main, { mode: 'cors' })!).text(), /release = 1/);
  assert.match(await (await h.get(lazy, { mode: 'cors' })!).text(), /optional = 1/, 'a background-cached feature remains loadable offline');
  for (const pathname of ['/api/ai', '/api/platform', '/api/article-assets/private', '/?callback=private']) assert.equal(h.get(pathname), undefined, pathname + ' is never intercepted');
  assert.equal(h.get(main, { method: 'POST' }), undefined);
  assert.equal(h.get(main, { headers: new Headers({ Authorization: 'private' }) }), undefined);
  assert.equal(h.get('/', { mode: 'cors', headers: new Headers({ RSC: '1' }) }), undefined);
  assert.equal(h.get(main, { url: 'https://another.test' + main }), undefined);
  await h.lifecycle('activate');
  assert.equal(h.stores.has('kaipai-public-shell-old'), false);
  assert.equal(h.stores.has('another-app'), true, 'other application caches are untouched');
  assert.equal(h.claims(), 1);
  for (const options of [{ invalidAsset: true }, { mixedShell: true }]) {
    const bad = harness(options);
    await assert.rejects(bad.lifecycle('install'));
    assert.equal(bad.stores.has('kaipai-public-shell-new'), false, 'incomplete or mismatched release cannot become a cached home');
    assert.equal(bad.stores.has('kaipai-public-shell-old'), true, 'failed update preserves working release');
    assert.equal(bad.stores.get('kaipai-public-shell-old')!.has(origin + lazy), false, 'failed install cannot backfill partial unverified releases');
  }
  const stale = harness({ cached404: true });
  await stale.lifecycle('install');
  assert.ok(stale.calls.some(request => request.cache === 'reload'), 'a cached 404 must be bypassed before rejecting the install');
  stale.offline();
  assert.match(await (await stale.get(main, { mode: 'cors' })!).text(), /release = 1/);
  const optionalFailure = harness({ invalidOptional: true });
  await optionalFailure.lifecycle('install');
  assert.equal((await optionalFailure.warm()).failed, true);
  optionalFailure.offline();
  assert.match(await (await optionalFailure.get('/')!).text(), /main\.js/, 'a failed optional download cannot discard a complete basic editor');
  assert.equal(optionalFailure.stores.get('kaipai-public-shell-new')!.has(origin + lazy), false, 'invalid optional code is never cached');
  const onDemand = harness();
  await onDemand.lifecycle('install');
  assert.match(await (await onDemand.get(lazy, { mode: 'cors' })!).text(), /optional = 1/);
  onDemand.offline();
  assert.match(await (await onDemand.get(lazy, { mode: 'cors' })!).text(), /optional = 1/, 'first use caches a verified optional feature');
  const progressive = harness({ twoOptional: true });
  await progressive.lifecycle('install');
  assert.equal((await progressive.warm()).remaining, 1);
  assert.equal(progressive.stores.get('kaipai-public-shell-new')!.has(origin + later), false, 'one idle request must not fan out into the rest of the cache');
  assert.equal((await progressive.warm()).remaining, 0);
  assert.match(await progressive.stores.get('kaipai-public-shell-new')!.get(origin + later)!.clone().text(), /later = 1/);
  console.log('PASS: core-only cache readiness, idle/on-demand optional loading, failed optional recovery, credential/API exclusion and old-shell preservation');
}
