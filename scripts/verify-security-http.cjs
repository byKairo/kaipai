/** Isolated HTTP regression: generated test-only secrets, local mock, no paid providers. */
const assert = require('node:assert/strict');
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
async function main() {
  const dummy = 'test-only-' + randomBytes(16).toString('hex');
  let redirected = false;
  let redirectMode = false;
  let streamMode = '';
  const mock = http.createServer((req, res) => {
    if (req.url === '/stolen') redirected = true;
    assert.equal(req.headers.authorization, `Bearer ${dummy}`);
    res.setHeader('Content-Type', 'application/json');
    if (redirectMode) { res.writeHead(302, { Location: '/stolen' }); return res.end(JSON.stringify({ error: dummy })); }
    if (req.url.endsWith('/models')) return res.end(JSON.stringify({ data: [{ id: 'test-model' }] }));
    if (streamMode) {
      let body = ''; req.on('data', chunk => body += chunk);
      req.on('end', () => {
        assert.equal(JSON.parse(body).stream, true);
        res.setHeader('Content-Type', 'text/event-stream');
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '测试完整回复' }, finish_reason: null }] }) + '\n\n');
        if (streamMode === 'complete') res.write('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
        res.end();
      });
      return;
    }
    res.statusCode = 500;
    res.end(JSON.stringify({ error: { message: dummy } }));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const probe = http.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const root = `http://127.0.0.1:${port}`;
  const baseUrl = `http://127.0.0.1:${mock.address().port}/v1`;
  const ring = JSON.stringify({ active: 'test', keys: { test: randomBytes(32).toString('base64') } });
  const cloudflare = process.argv.includes('--cloudflare');
  const args = cloudflare
    ? ['.cloudflare-deploy/node_modules/wrangler/bin/wrangler.js', 'dev', '--config', '.cloudflare-deploy/dist/server/wrangler.json', '--ip', '127.0.0.1', '--port', String(port), '--var', 'KAIPAI_ALLOW_LOOPBACK_API:1', '--var', `KAIPAI_CREDENTIAL_KEYS:${ring}`]
    : ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)];
  const app = spawn(process.execPath, args, { env: { ...process.env, KAIPAI_ALLOW_LOOPBACK_API: '1', KAIPAI_AI_STREAM: '1', KAIPAI_CREDENTIAL_KEYS: ring, WRANGLER_SEND_METRICS: 'false' }, stdio: 'ignore' });
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(root)).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'isolated production server starts');
    const home = await fetch(root);
    assert.equal(home.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'self'/);
    const send = (route, body, origin = root) => fetch(root + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const input = { provider: 'Custom', apiKey: dummy, baseUrl };
    const sealed = await send('/api/credentials/seal', input);
    assert.equal(sealed.status, 200);
    assert.match(sealed.headers.get('cache-control'), /no-store/);
    const sealedBody = await sealed.text();
    assert.ok(!sealedBody.includes(dummy));
    const credential = JSON.parse(sealedBody).credential;
    const saved = { ...input, apiKey: credential };
    const models = await send('/api/ai/connection-models', saved);
    assert.equal(models.status, 200, 'saved credential still works');
    assert.equal((await models.json()).models[0].id, 'test-model');
    const resealed = await send('/api/credentials/seal', saved);
    assert.equal(resealed.status, 200, 'existing v1 credentials can still be saved');
    const blocked = await send('/api/credentials/seal', saved, 'https://attacker.invalid');
    assert.equal(blocked.status, 403);
    const failed = await send('/api/ai', { ...saved, endpoint: baseUrl, model: 'test-model', action: 'test' });
    assert.equal(failed.status, 502);
    assert.ok(!(await failed.text()).includes(dummy), 'upstream error does not echo key');
    streamMode = 'complete';
    const streamed = await send('/api/ai', { ...saved, endpoint: baseUrl, model: 'test-model', action: 'plan', prompt: 'test' });
    assert.equal(streamed.status, 200);
    assert.equal((await streamed.json()).text, '测试完整回复');
    streamMode = 'truncated';
    const truncated = await send('/api/ai', { ...saved, endpoint: baseUrl, model: 'test-model', action: 'plan', prompt: 'test' });
    assert.equal(truncated.status, 502);
    assert.ok(!(await truncated.text()).includes('测试完整回复'), 'incomplete output never applied');
    streamMode = '';
    redirectMode = true;
    for (const route of ['/api/ai/connection-models', '/api/ai/image-models', '/api/ai', '/api/ai/image']) {
      const response = await send(route, { ...saved, endpoint: baseUrl, model: 'test-model', action: 'test', adapter: 'openai-images', prompt: 'test' });
      assert.ok(response.status >= 400, `${route} rejects redirect`);
      assert.ok(!(await response.text()).includes(dummy));
    }
    assert.equal(redirected, false, 'credentials never forwarded to redirect target');
    if (cloudflare) {
      let limited;
      for (let i = 0; i < 125; i++) {
        const response = await fetch(root + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: root, 'CF-Connecting-IP': '198.51.100.77' }, body: '{}', signal: AbortSignal.timeout(5000) });
        if (response.status === 429) { limited = response; break; }
        assert.equal(response.status, 400, 'invalid request never calls a provider');
      }
      assert.ok(limited, 'Cloudflare native binding blocks excessive requests');
      assert.equal(limited.headers.get('retry-after'), '60');
      assert.equal((await fetch(root)).status, 200, 'API limit does not block page');
      console.log('PASS: native Cloudflare rate limit returns 429 without model calls');
    }
    console.log('PASS: production headers, saved credentials, no-store, cross-site rejection, redacted upstream errors redirect containment, complete streaming and rejected truncated output');
  } finally {
    app.kill('SIGTERM');
    await new Promise(resolve => mock.close(resolve));
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
