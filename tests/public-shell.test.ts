import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';

const origin = 'https://kaipai.test';
const main = '/_next/static/chunks/main.js', lazy = '/_next/static/chunks/lazy.js';
const bytes = new Map([[main, 'export const release = 1;'], [lazy, 'export const optional = 1;']]);
const template = fs.readFileSync(path.resolve(__dirname, '../cloudflare/service-worker.js'), 'utf8');
type WorkerEvent = { request?: any; waitUntil?: (promise: Promise<unknown>) => void; respondWith?: (promise: Promise<Response>) => void };
function harness(options: { invalidAsset?: boolean; mixedShell?: boolean; cached404?: boolean } = {}) {
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
    return new Response(options.invalidAsset ? '<html>error</html>' : bytes.get(url.pathname), { headers: { 'Content-Type': 'application/javascript' } });
  };
  let source = template;
  for (const [token, value] of Object.entries({ __KAIPAI_RELEASE__: 'new', __KAIPAI_PRECACHE__: [main, lazy], __KAIPAI_BOOTSTRAP__: [main], __KAIPAI_ALLOWED_ASSETS__: [main, lazy], __KAIPAI_ASSET_HASHES__: Object.fromEntries(Array.from(bytes).map(([file, body]) => [file, createHash('sha256').update(body).digest('hex')])) })) source = source.replace(token, JSON.stringify(value));
  vm.runInNewContext(source, { self: { location: { origin }, clients: { claim: async () => { claims++; } }, addEventListener: (name: string, fn: (event: WorkerEvent) => void) => listeners.set(name, fn) }, caches, fetch: fetcher, Request, Response, URL, crypto: webcrypto });
  const lifecycle = (name: string) => { let pending: Promise<unknown> | undefined; listeners.get(name)!({ waitUntil: promise => { pending = promise; } }); return pending!; };
  const get = (pathname: string, extra: Record<string, unknown> = {}) => {
    const request = { url: origin + pathname, method: 'GET', mode: 'navigate', headers: new Headers(), ...extra };
    let result: Promise<Response> | undefined;
    listeners.get('fetch')!({ request, respondWith: promise => { result = promise; } });
    return result;
  };
  return { stores, calls, lifecycle, get, offline: () => { offline = true; }, claims: () => claims };
}

export async function run() {
  const h = harness();
  await h.lifecycle('install');
  assert.ok(h.stores.has('kaipai-public-shell-old'), 'install leaves the previous complete release intact');
  const oldCache = h.stores.get('kaipai-public-shell-old')!;
  assert.equal(await oldCache.get(origin + '/')!.clone().text(), '<html>old complete home</html>', 'install must not replace an active old page');
  assert.match(await oldCache.get(origin + lazy)!.clone().text(), /optional = 1/, 'new install repairs old shells with missing immutable modules');
  assert.ok(h.calls.every(request => request.credentials === 'omit'), 'public cache setup does not request credentials');
  h.offline();
  assert.match(await (await h.get('/')!).text(), /main\.js/);
  assert.match(await (await h.get(main, { mode: 'cors' })!).text(), /release = 1/);
  assert.match(await (await h.get(lazy, { mode: 'cors' })!).text(), /optional = 1/, 'a never-opened feature remains loadable after its remote release disappears');
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
  assert.match(await (await stale.get(lazy, { mode: 'cors' })!).text(), /optional = 1/);
  console.log('PASS: offline public shell, credential/API exclusion, complete-release validation, failed update recovery and scoped cache cleanup');
}
