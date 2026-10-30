/** Compare identical production builds, independent of browser/SW caches.
 * gzip is an estimate, not a claim about the production Content-Encoding.
 * Usage: node scripts/measure-first-visit.cjs <deployment-dir> <local-url> <report.json>
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
async function main() {
  const [deployment, url, output] = process.argv.slice(2);
  if (!deployment || !url || !output) throw new Error('Expected deployment directory, URL, report path');
  const client = path.join(deployment, 'dist/client');
  const manifest = JSON.parse(fs.readFileSync(path.join(client, '.vite/manifest.json'), 'utf8'));
  const visited = new Set(), assets = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    const entry = manifest[key];
    if (!entry) throw new Error('Missing manifest entry ' + key);
    visited.add(key); assets.add(entry.file);
    for (const css of entry.css || []) assets.add(css);
    for (const dependency of entry.imports || []) visit(dependency);
  }
  visit('virtual:vinext-app-browser-entry'); visit('app/page.tsx');
  const response = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!response.ok) throw new Error('Home returned ' + response.status);
  const html = await response.text();
  const size = text => ({ decodedBytes: Buffer.byteLength(text), estimatedGzipBytes: zlib.gzipSync(text).length });
  const inlineCss = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n');
  const resources = [...assets].sort().map(file => ({ file, ...size(fs.readFileSync(path.join(client, file))) }));
  const js = resources.filter(item => item.file.endsWith('.js'));
  const report = { measuredAt: new Date().toISOString(), method: 'Fresh HTTP document plus transitive static manifest imports; deferred chunks excluded; gzip estimates, not network timings',
    document: size(html), inlineCss: size(inlineCss), staticJs: { files: js.length, decodedBytes: js.reduce((s,r) => s+r.decodedBytes,0), estimatedGzipBytes: js.reduce((s,r) => s+r.estimatedGzipBytes,0) },
    headers: Object.fromEntries(response.headers), resources };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ document: report.document, inlineCss: report.inlineCss, staticJs: report.staticJs, output }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
