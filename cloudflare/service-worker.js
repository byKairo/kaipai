/* Public application shell only. Never intercept API requests or cache user data. */
const VERSION = __KAIPAI_RELEASE__;
const PRECACHE = __KAIPAI_PRECACHE__;
const OPTIONAL = __KAIPAI_OPTIONAL__;
const BOOTSTRAP = __KAIPAI_BOOTSTRAP__;
const ALLOWED_ASSETS = new Set(__KAIPAI_ALLOWED_ASSETS__);
const ASSET_HASHES = __KAIPAI_ASSET_HASHES__;
const PREFIX = 'kaipai-public-shell-';
const CACHE = PREFIX + VERSION;
const HOME = new URL('/', self.location.origin).href;

async function verifyAsset(response, asset) {
  const mime = response.headers.get('content-type') || '';
  if (!response.ok || response.redirected || response.type === 'opaque' ||
      (asset.endsWith('.css') ? !mime.includes('text/css') : !/javascript/.test(mime))) throw new Error('Invalid public asset');
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  if (hash !== ASSET_HASHES[asset]) throw new Error('Public asset belongs to another release');
}

async function fetchAsset(asset, signal) {
  const url = new URL(asset, HOME);
  const options = { credentials: 'omit', cache: 'force-cache', priority: 'low', signal };
  let response = await fetch(new Request(url, options));
  try { await verifyAsset(response, asset); }
  catch {
    response = await fetch(new Request(url, { ...options, cache: 'reload' }));
    await verifyAsset(response, asset);
  }
  return response;
}

async function repairPrevious(cache, assets) {
  for (const name of await caches.keys()) {
    if (!name.startsWith(PREFIX) || name === CACHE) continue;
    try {
      const previous = await caches.open(name);
      if (!await previous.match(HOME)) continue;
      for (const asset of assets) {
        const url = new URL(asset, HOME).href;
        if (!await previous.match(url)) await previous.put(url, await cache.match(url));
      }
    } catch { /* An old cache must not prevent a current core from becoming usable. */ }
  }
}

async function installShell() {
  await caches.delete(CACHE);
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(new Request(HOME, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'text/html' } }));
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Shell unavailable');
    const html = await response.clone().text();
    if (!BOOTSTRAP.every(asset => html.includes(asset))) throw new Error('Release changed during cache setup');
    const pending = [...PRECACHE];
    await Promise.all([0, 1].map(async () => {
      while (pending.length) {
        const asset = pending.shift();
        await cache.put(new URL(asset, HOME).href, await fetchAsset(asset));
      }
    }));
    // Repair missing immutable code in still-active older shells, without
    // replacing their HTML or activating new code beneath an open editor.
    await repairPrevious(cache, PRECACHE);
    // Publish the document last, after all required files are available.
    await cache.put(HOME, response);
  } catch (error) { await caches.delete(CACHE); throw error; }
}
self.addEventListener('install', event => { event.waitUntil(installShell()); });

// The page requests one optional file at a time, only after a quiet idle period.
// A failed optional download never discards the complete basic editor cache.
let warming;
async function warmNext() {
  const cache = await caches.open(CACHE);
  if (!await cache.match(HOME)) return { remaining: 0 };
  const missing = [];
  for (const asset of OPTIONAL) if (!await cache.match(new URL(asset, HOME).href)) missing.push(asset);
  if (!missing.length) return { remaining: 0 };
  const asset = missing[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    await cache.put(new URL(asset, HOME).href, await fetchAsset(asset, controller.signal));
    await repairPrevious(cache, [asset]);
    return { remaining: missing.length - 1 };
  } catch { return { remaining: missing.length, failed: true }; }
  finally { clearTimeout(timer); }
}
self.addEventListener('message', event => {
  if (event.data?.type !== 'KAIPAI_CACHE_NEXT') return;
  warming ??= warmNext().catch(() => ({ remaining: OPTIONAL.length, failed: true })).finally(() => { warming = undefined; });
  event.waitUntil(warming.then(result => event.ports?.[0]?.postMessage(result)));
});
// Do not skip waiting: a release must not replace code beneath an open document.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  const home = request.mode === 'navigate' && url.pathname === '/' && !url.search;
  const asset = !url.search && ALLOWED_ASSETS.has(url.pathname);
  if (!home && !asset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(home ? HOME : request);
    if (cached) return cached;
    const response = await fetch(request);
    if (asset && response.ok) {
      try { await verifyAsset(response, url.pathname); }
      catch { return Response.error(); }
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
