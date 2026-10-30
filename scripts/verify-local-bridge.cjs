/** Exercise the actual cross-origin bridge routes with synthetic keys only. */
const http = require('node:http');
const assert = require('node:assert/strict');
const origin = 'https://kaipai.kairostudio.workers.dev';
const app = 'http://127.0.0.1:3003';
async function main() {
  const server = http.createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    assert.equal(req.headers.authorization, 'Bearer bridge-test');
    res.setHeader('content-type', 'application/json');
    if (req.url === '/v1/models') res.end(JSON.stringify({ data: [{ id: 'private-text', architecture: { output_modalities: ['text'] } }, { id: 'private-cover', architecture: { output_modalities: ['image'] } }, { id: 'unclassified' }] }));
    else if (req.url === '/v1/chat/completions') { assert.equal(body.model, 'private-text'); res.end(JSON.stringify({ choices: [{ message: { content: '连接成功' } }] })); }
    else if (req.url === '/v1/images/generations') { assert.equal(body.model, 'private-cover'); res.end(JSON.stringify({ data: [{ b64_json: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN4AAAAASUVORK5CYII=' }] })); }
    else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    const headers = { origin, 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' };
    const preflight = await fetch(app + '/api/ai', { method: 'OPTIONS', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type', 'access-control-request-private-network': 'true' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
    assert.equal(preflight.headers.get('access-control-allow-private-network'), 'true');
    async function send(path, body) {
      const response = await fetch(app + path, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await response.json();
      assert.equal(response.status, 200, JSON.stringify(data));
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      return data;
    }
    const common = { provider: 'Custom', baseUrl, apiKey: 'bridge-test' };
    const directory = await send('/api/ai/connection-models', common);
    assert.equal(directory.models.length, 3);
    assert.deepEqual(directory.models[1].kinds, ['image']);
    const seal = await send('/api/credentials/seal', common);
    assert.ok(seal.credential && !seal.credential.includes('bridge-test'));
    const saved = { ...common, apiKey: seal.credential };
    assert.equal((await send('/api/ai', { ...saved, endpoint: baseUrl, model: 'private-text', action: 'test' })).text, '连接成功');
    assert.match((await send('/api/ai/image', { ...saved, model: 'private-cover', prompt: 'test' })).src, /^data:image\/png/);
    const imageTest = await send('/api/ai/image', { ...saved, model: 'private-cover', prompt: 'test', action: 'test' });
    assert.deepEqual(imageTest, { ok: true, model: 'private-cover' });
    const denied = await fetch(app + '/api/ai/connection-models', { method: 'POST', headers: { ...headers, origin: 'https://evil.example' }, body: JSON.stringify(common) });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    console.log('PASS: website origin preflight, local discovery, capability metadata, sealing, restored text/image calls, unrelated origin denied');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
