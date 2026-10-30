/** Preserve immutable public build assets across deployments; never archive HTML, APIs or credentials. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const history = path.join(root, 'cloudflare/asset-history');
const production = 'https://kaipai.kairostudio.workers.dev';
const assetPath = /^\/_next\/static\/(?:chunks|css)\/[\w.-]+\.(?:js|css)$/;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function validateAssets(assets) {
  if (!assets || !Object.keys(assets).length) throw new Error('Empty release asset manifest');
  for (const [file, sha256] of Object.entries(assets)) {
    if (!assetPath.test(file) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid public release asset: ' + file);
  }
  return assets;
}
function readHistory(directory = history) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 1) throw new Error('Unsupported release asset history');
  validateAssets(manifest.assets);
  return manifest;
}
function copyRetained(client, directory = history) {
  const manifest = readHistory(directory);
  for (const [file, sha256] of Object.entries(manifest.assets)) {
    const bytes = fs.readFileSync(path.join(directory, file));
    if (hash(bytes) !== sha256) throw new Error('Retained asset hash mismatch: ' + file);
    const target = path.join(client, file);
    if (fs.existsSync(target) && hash(fs.readFileSync(target)) !== sha256) throw new Error('Immutable asset collision: ' + file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  return manifest.assets;
}
function parseShell(source) {
  const hashes = /^const ASSET_HASHES = (.+);$/m.exec(source);
  const version = /^const VERSION = (.+);$/m.exec(source);
  if (!hashes || !version) throw new Error('Production public shell manifest unavailable');
  return { version: JSON.parse(version[1]), assets: validateAssets(JSON.parse(hashes[1])) };
}
async function download(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`Public asset HTTP ${response.status}: ${url}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length > 8 * 1024 * 1024) throw new Error('Public asset exceeds 8 MiB: ' + url);
      return data;
    } catch (error) { last = error; }
  }
  throw last;
}
async function readProduction(origin = production) {
  return parseShell((await download(new URL('/sw.js', origin))).toString('utf8'));
}
async function syncProduction(directory = history, origin = production) {
  const live = await readProduction(origin);
  const manifest = readHistory(directory);
  const pending = Object.entries(live.assets);
  // Keep this sequential at the manifest level; a partial download must never
  // publish an incomplete release. Only public code bytes are written.
  const downloaded = new Map();
  await Promise.all([0, 1, 2, 3].map(async () => {
    while (pending.length) {
      const [file, sha256] = pending.shift();
      if (manifest.assets[file] && manifest.assets[file] !== sha256) throw new Error('Immutable production asset collision: ' + file);
      const target = path.join(directory, file);
      if (fs.existsSync(target) && hash(fs.readFileSync(target)) === sha256) continue;
      const bytes = await download(new URL(file, origin));
      if (hash(bytes) !== sha256) throw new Error('Production asset hash mismatch: ' + file);
      downloaded.set(file, bytes);
    }
  }));
  for (const [file, bytes] of downloaded) {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  Object.assign(manifest.assets, live.assets);
  manifest.assets = Object.fromEntries(Object.entries(manifest.assets).sort(([a], [b]) => a.localeCompare(b)));
  manifest.releases[live.version] = Object.keys(live.assets).sort();
  fs.writeFileSync(path.join(directory, 'manifest.json.tmp'), JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(path.join(directory, 'manifest.json.tmp'), path.join(directory, 'manifest.json'));
  console.log(`Retained production shell ${live.version}: ${Object.keys(live.assets).length} verified assets; ${downloaded.size} downloaded.`);
}
async function verifyProduction(client, origin = production) {
  const live = await readProduction(origin);
  for (const [file, sha256] of Object.entries(live.assets)) {
    const target = path.join(client, file);
    if (!fs.existsSync(target) || hash(fs.readFileSync(target)) !== sha256) {
      throw new Error('Deployment would break an existing page: ' + file + '. Run npm run cf:sync-assets, then rebuild.');
    }
  }
  console.log(`Production compatibility verified: ${Object.keys(live.assets).length} existing assets preserved.`);
}
function publicAssets(manifest, styles) {
  return [...new Set([...Object.values(manifest).flatMap(item => [item.file, ...(item.css || [])]), ...styles])]
    .map(file => '/' + file).filter(file => assetPath.test(file)).sort();
}
function collectPrecache(manifest, entries, styles, { dynamic = true } = {}) {
  const needed = new Set(styles.map(file => '/' + file));
  const visited = new Set();
  function visit(key) {
    if (visited.has(key) || !manifest[key]) return;
    visited.add(key);
    const item = manifest[key];
    for (const file of [item.file, ...(item.css || [])]) if (assetPath.test('/' + file)) needed.add('/' + file);
    for (const imported of [...(item.imports || []), ...(dynamic ? item.dynamicImports || [] : [])]) visit(imported);
  }
  entries.forEach(visit);
  return [...needed].sort();
}
module.exports = { copyRetained, parseShell, publicAssets, collectPrecache, readHistory, syncProduction, verifyProduction };
if (require.main === module) {
  const action = process.argv[2];
  const result = action === 'sync' ? syncProduction() : action === 'verify' ? verifyProduction(path.join(root, '.cloudflare-deploy/dist/client')) : Promise.reject(new Error('Use release-assets.cjs sync|verify'));
  result.catch(error => { console.error(error.message); process.exitCode = 1; });
}
