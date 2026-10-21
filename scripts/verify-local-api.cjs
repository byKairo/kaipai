/** Production route acceptance using a local mock, never real credentials or paid model requests. */
const http = require('node:http');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const appUrl = process.env.WORKSPACE_URL || 'http://127.0.0.1:3003';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN4AAAAASUVORK5CYII=';
async function main() {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    try {
      assert.equal(req.headers.authorization, 'Bearer local-test-only');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
      calls.push({ method: req.method, path: req.url });
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'text-test' }, { id: 'image-test' }] }));
      if (req.url === '/v1/chat/completions') {
        assert.equal(body.model, 'text-test');
        assert.ok(Array.isArray(body.messages));
        return res.end(JSON.stringify({ choices: [{ message: { content: '连接成功' } }] }));
      }
      if (req.url === '/v1/images/generations') {
        assert.equal(body.model, 'image-test');
        assert.ok(body.prompt);
        return res.end(JSON.stringify({ data: [{ b64_json: png }] }));
      }
      res.statusCode = 404;res.end('{}');
    } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: { message: error.message } })); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
    const send = async (route, body) => {
      const response = await fetch(`${appUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      assert.equal(response.status, 200, JSON.stringify(payload));
      assert.equal(payload.ok, true, JSON.stringify(payload));
      return payload;
    };
    const common = { provider: 'Custom', apiKey: 'local-test-only', baseUrl };
    const models = await send('/api/ai/connection-models', common);
    assert.deepEqual(models.models.map(model => model.id), ['text-test', 'image-test']);
    const text = await send('/api/ai', { ...common, endpoint: baseUrl, model: 'text-test', action: 'test' });
    assert.equal(text.text, '连接成功');
    const imageModels = await send('/api/ai/image-models', common);
    assert.deepEqual(imageModels.models.map(model => model.id), ['image-test']);
    const image = await send('/api/ai/image', { ...common, model: 'image-test', adapter: 'openai-images', prompt: 'test' });
    assert.equal(image.src, `data:image/png;base64,${png}`);
    for (const route of ['/api/ai/connection-models', '/api/ai/image-models', '/api/ai', '/api/ai/image']) {
      const body = { ...common, baseUrl: 'http://192.168.1.1/v1', endpoint: 'http://192.168.1.1/v1', model: 'test', prompt: 'test' };
      const response = await fetch(`${appUrl}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const payload = await response.json();
      assert.equal(response.status, 400);
      assert.equal(payload.ok, false);
      assert.match(payload.error, /公网/);
    }
    const report = { localProductionRoutes: true, models: true, text: true, imageModels: true, image: true, privateNetworkRejected: true, realProviderTested: false, calls };
    fs.writeFileSync(path.join(__dirname, '../docs/validation/local-api-report.json'), JSON.stringify(report, null, 2));
    console.log('PASS: local production discovery, text, image discovery, image generation and consistent private-network validation');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error);process.exitCode = 1; });
