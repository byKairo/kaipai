import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import http from 'node:http';

const { copyRetained, parseShell, publicAssets, collectPrecache, syncProduction, verifyProduction } = require('../scripts/release-assets.cjs');
const oldAsset = '/_next/static/chunks/previous.js';
const oldBytes = 'export const previous = true;';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export async function run() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kaipai-release-assets-'));
  const history = path.join(tmp, 'history'), client = path.join(tmp, 'client');
  const assets = { [oldAsset]: sha256(oldBytes) };
  const shell = `const VERSION = "production";\nconst ASSET_HASHES = ${JSON.stringify(assets)};`;
  let corrupt = false;
  const server = http.createServer((request, response) => {
    response.end(request.url === '/sw.js' ? shell : corrupt ? 'wrong release' : oldBytes);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    fs.mkdirSync(path.join(history, '_next/static/chunks'), { recursive: true });
    fs.writeFileSync(path.join(history, oldAsset), oldBytes);
    fs.writeFileSync(path.join(history, 'manifest.json'), JSON.stringify({ schema: 1, assets, releases: { old: [oldAsset] } }));
    assert.deepEqual(copyRetained(client, history), assets);
    assert.equal(fs.readFileSync(path.join(client, oldAsset), 'utf8'), oldBytes);
    await verifyProduction(client, origin);
    fs.rmSync(path.join(client, oldAsset));
    await assert.rejects(verifyProduction(client, origin), /would break an existing page/);
    fs.writeFileSync(path.join(client, oldAsset), 'another release under the same URL');
    assert.throws(() => copyRetained(client, history), /Immutable asset collision/);
    fs.rmSync(path.join(client, oldAsset));
    fs.writeFileSync(path.join(history, oldAsset), 'modified bytes');
    assert.throws(() => copyRetained(client, history), /hash mismatch/);
    await syncProduction(history, origin);
    assert.equal(fs.readFileSync(path.join(history, oldAsset), 'utf8'), oldBytes, 'sync restores only verified public bytes');
    const manifest = fs.readFileSync(path.join(history, 'manifest.json'), 'utf8');
    fs.rmSync(path.join(history, oldAsset));
    corrupt = true;
    await assert.rejects(syncProduction(history, origin), /hash mismatch/);
    assert.equal(fs.readFileSync(path.join(history, 'manifest.json'), 'utf8'), manifest, 'failed downloads cannot publish a partial manifest');
    assert.deepEqual(parseShell(shell).assets, assets);
    for (const file of ['/api/ai', '/sw.js', '/_next/static/chunks/../../secret.js']) {
      assert.throws(() => parseShell(`const VERSION = "bad";\nconst ASSET_HASHES = ${JSON.stringify({ [file]: sha256('secret') })};`), /Invalid public release asset/);
    }
    assert.deepEqual(publicAssets({ main: { file: '_next/static/chunks/main.js', css: ['_next/static/css/main.css'] }, secret: { file: 'api/private.js' } }, []), ['/_next/static/chunks/main.js', '/_next/static/css/main.css']);
    const graph = {
      page: { file: '_next/static/chunks/page.js', imports: ['shared'] },
      shared: { file: '_next/static/chunks/shared.js', dynamicImports: ['local-api'] },
      'local-api': { file: '_next/static/chunks/local-api.js', imports: ['shared'], dynamicImports: ['credential'] },
      credential: { file: '_next/static/chunks/credential.js', css: ['_next/static/css/credential.css'] },
      unrelated: { file: '_next/static/chunks/unrelated.js' },
    };
    assert.deepEqual(collectPrecache(graph, ['page'], []), [
      '/_next/static/chunks/credential.js', '/_next/static/chunks/local-api.js', '/_next/static/chunks/page.js',
      '/_next/static/chunks/shared.js', '/_next/static/css/credential.css',
    ], 'precache must include transitive dynamic dependencies and handle cycles');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log('PASS: historical asset preservation, immutable URL collision detection, production compatibility gate and atomic verified sync');
}
