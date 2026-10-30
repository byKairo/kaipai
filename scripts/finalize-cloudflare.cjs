/** Generate a release-bound public-shell cache after the client manifest exists. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { copyRetained, publicAssets, collectPrecache } = require('./release-assets.cjs');
const root = path.resolve(__dirname, '..');
const client = path.join(root, '.cloudflare-deploy/dist/client');
const manifest = JSON.parse(fs.readFileSync(path.join(client, '.vite/manifest.json'), 'utf8'));
// vinext's global styles are emitted separately from Vite's manifest.
const styles = fs.readdirSync(path.join(client, '_next/static/css')).filter(file => file.endsWith('.css')).map(file => '_next/static/css/' + file);
const currentAssets = publicAssets(manifest, styles);
const retained = copyRetained(client);
const assets = [...new Set([...currentAssets, ...Object.keys(retained)])].sort();
// Cache only the static startup graph and rich editor before publishing HOME.
// Optional panels/importers and historical releases stay available on the server,
// but never hold a usable current shell hostage to their background downloads.
const referencedCss = new Set(Object.values(manifest).flatMap(item => item.css || []));
const globalStyles = styles.filter(file => !referencedCss.has(file));
const needed = collectPrecache(manifest, ['virtual:vinext-app-browser-entry', 'app/page.tsx', 'app/error.tsx', 'app/rich-editor.tsx'], globalStyles, { dynamic: false });
const optional = currentAssets.filter(file => !needed.includes(file));
const bootstrap = ['virtual:vinext-app-browser-entry', 'app/page.tsx'].map(key => {
  if (!manifest[key]) throw new Error('Missing public shell entry: ' + key);
  return '/' + manifest[key].file;
});
const template = fs.readFileSync(path.join(root, 'cloudflare/service-worker.js'), 'utf8');
const hashes = Object.fromEntries(assets.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(client, file.slice(1)))).digest('hex')]));
const version = crypto.createHash('sha256').update(require('./verify-cloudflare-build.cjs').sourceDigest())
  .update(fs.readFileSync(path.join(root, '.cloudflare-deploy/dist/server/BUILD_ID'))).update(JSON.stringify(assets)).update(template).digest('hex').slice(0, 20);
let source = template;
for (const [token, value] of Object.entries({ __KAIPAI_RELEASE__: version, __KAIPAI_PRECACHE__: needed, __KAIPAI_OPTIONAL__: optional, __KAIPAI_BOOTSTRAP__: bootstrap, __KAIPAI_ALLOWED_ASSETS__: assets, __KAIPAI_ASSET_HASHES__: hashes })) source = source.replace(token, JSON.stringify(value));
if (/__KAIPAI_[A-Z_]+__/.test(source)) throw new Error('Unresolved public shell token');
fs.writeFileSync(path.join(client, 'sw.js'), source);
const headers = path.join(client, '_headers');
fs.appendFileSync(headers, '\n/sw.js\n  Cache-Control: no-cache\n  Service-Worker-Allowed: /\n');
fs.writeFileSync(path.join(root, '.cloudflare-deploy/public-shell.json'), JSON.stringify({ version, bootstrap, precache: needed, optional, allowedAssets: assets }, null, 2));
console.log(`Public shell ${version}: ${needed.length} core assets, ${optional.length} idle/on-demand assets; ${Object.keys(retained).length} retained on server; APIs excluded.`);
