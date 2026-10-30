/** Exercise the deployed Workers bundle locally; all supplier responses are disposable fixtures. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const app = process.env.WORKSPACE_URL || 'http://127.0.0.1:8788';
assert.equal(new URL(app).hostname, '127.0.0.1');
let scenario = 'normal', calls = 0;
const supplier = http.createServer(async (request, response) => {
  calls++;
  for await (const _ of request) { /* drain fixture request */ }
  response.setHeader('Content-Type', scenario === 'sse' ? 'text/event-stream' : 'application/json');
  if (scenario === 'image-limit') {
    response.setHeader('Content-Length', 36 * 1024 * 1024 + 1);
    response.flushHeaders();
    return;
  }
  if (scenario === 'oversized' || scenario === 'sse') {
    const chunk = scenario === 'sse' ? ':' + 'x'.repeat(65532) + '\n\n' : ' '.repeat(65536);
    // No Content-Length: the Worker must enforce the actual received bytes.
    for (let i = 0; i < 132 && !response.destroyed; i++) {
      if (!response.write(chunk)) {
        const ready = await new Promise(resolve => {
          const drain = () => { response.off('close', close); resolve(true); };
          const close = () => { response.off('drain', drain); resolve(false); };
          response.once('drain', drain); response.once('close', close);
        });
        if (!ready) return;
      }
    }
    response.end('{}');
    return;
  }
  response.end(JSON.stringify(request.url.endsWith('/models')
    ? { data: [{ id: 'test-model' }] }
    : { choices: [{ message: { content: '正常回复' }, finish_reason: 'stop' }] }));
});
async function main() {
  await new Promise(resolve => supplier.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${supplier.address().port}/v1`;
  const checks = [];
  async function send(route, extra = {}) {
    const response = await fetch(app + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: app },
      body: JSON.stringify({ provider: 'Custom', apiKey: 'runtime-fixture-only', baseUrl, endpoint: baseUrl, model: 'test-model', action: 'test', prompt: '测试', ...extra }), signal: AbortSignal.timeout(15000) });
    const body = await response.json(); return { response, body };
  }
  try {
    assert.equal((await send('/api/ai')).body.text, '正常回复');
    checks.push('normal Chat response through Workers');
    for (const [mode, route, extra] of [
      ['oversized', '/api/ai', {}],
      ['oversized', '/api/ai', { adapter: 'openai-responses' }],
      ['oversized', '/api/ai/connection-models', {}],
      ['oversized', '/api/ai/image-models', {}],
      ['sse', '/api/ai', {}],
      ['image-limit', '/api/ai/image', {}],
    ]) {
      scenario = mode;
      const { response, body } = await send(route, extra);
      assert.equal(response.status, 502, `${route}: ${JSON.stringify(body)}`);
      assert.match(body.error, /返回的数据过大/);
      assert.ok(!JSON.stringify(body).includes('runtime-fixture-only'));
      checks.push(`${route} ${mode} ${extra.adapter || ''}: bounded rejection`);
    }
    scenario = 'normal';
    assert.equal((await send('/api/ai')).body.text, '正常回复');
    checks.push('Worker remains usable after oversized responses');
    const report = { passed: true, target: app, realSupplier: false, checks, supplierCalls: calls };
    const out = path.resolve('docs/validation/optimization-release-20261026');
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'workers-runtime.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { supplier.closeAllConnections(); await new Promise(resolve => supplier.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
