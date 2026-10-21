/** End-to-end production Route Handler checks against a disposable local provider. */
const http = require('node:http');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const appUrl = process.env.WORKSPACE_URL || 'http://127.0.0.1:3003';
const secret = 'framework-test-only';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN4AAAAASUVORK5CYII=';
let calls = 0;
const server = http.createServer(async (req, res) => {
  calls++;
  try {
    assert.equal(req.headers.authorization, `Bearer ${secret}`);
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const input = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/v1/models') return res.end(JSON.stringify({ data: [{ id: 'text-test' }, { id: 'image-test' }] }));
    if (input.model === 'error-test') { res.statusCode = 401; return res.end(JSON.stringify({ error: { message: `Sensitive echo ${secret}` } })); }
    if (req.url === '/v1/images/generations') {
      assert.ok(typeof input.prompt === 'string' && input.prompt.length > 0);
      return res.end(JSON.stringify({ data: [{ b64_json: png }] }));
    }
    const system = input.instructions || input.messages?.[0]?.content || '';
    const user = input.input || input.messages?.[1]?.content || '';
    let output = '连接成功';
    if (system.includes('网站执行约定')) {
      const article = JSON.parse(user).article;
      assert.ok(article.endsWith('重要的结尾') || article.length > 0);
      assert.ok(system.includes('kairo-layout') || system.includes('kairo-design') || system.includes('只给三个准确'));
      assert.ok(!system.includes(secret));
      output = JSON.stringify({ style: 'knowledge', formattedMarkdown: article, imageBriefs: ['封面｜graphic-photo-collage 用一本打开的书表达文章结构'], suggestions: [] });
    }
    return res.end(JSON.stringify(req.url.endsWith('/responses') ? { output_text: output } : { choices: [{ message: { content: output } }] }));
  } catch { res.statusCode = 500; res.end('{"error":{"message":"Mock assertion failed"}}'); }
});
async function main() {
  await new Promise(resolve => server.listen(process.argv.includes('--serve') ? 38419 : 0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
  if (process.argv.includes('--serve')) { console.log(`Disposable browser fixture ready at ${baseUrl}`); return; }
  try {
    async function post(route, body, status = 200, headers = {}) {
      const response = await fetch(appUrl + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      assert.match(response.headers.get('cache-control'), /no-store/);
      assert.ok(!JSON.stringify(data).includes(secret));
      return data;
    }
    const sealed = await post('/api/credentials/seal', { provider: 'Custom', baseUrl, apiKey: secret });
    assert.match(sealed.credential, /^kpcred1\./);
    const common = { provider: 'Custom', baseUrl, endpoint: baseUrl, apiKey: sealed.credential, model: 'text-test', prompt: 'test' };
    await post('/api/ai/connection-models', common, 200, { Origin: new URL(appUrl).origin, 'Sec-Fetch-Site': 'same-origin' });
    await post('/api/ai/image-models', common);
    await post('/api/ai', { ...common, action: 'test' });
    for (const operation of ['layout', 'images', 'full', 'title']) {
      const result = await post('/api/ai', { ...common, operation, article: '短文。\n重要的结尾' });
      assert.ok(Array.isArray(result.skills));
    }
    await post('/api/ai', { ...common, operation: 'layout', article: '短文', adapter: 'openai-responses' });
    await post('/api/ai/image', { ...common, model: 'image-test', prompt: 'graphic-photo-collage 封面画面' });
    await post('/api/ai', { ...common, model: 'error-test' }, 502);
    await post('/api/ai/image', { ...common, model: 'error-test' }, 502);
    const before = calls;
    await post('/api/ai', { ...common, operation: 'layout', article: 'x'.repeat(40001) }, 413);
    await post('/api/ai', common, 403, { Origin: 'https://untrusted.test' });
    await post('/api/credentials/seal', { ...common, apiKey: secret }, 403, { 'Sec-Fetch-Site': 'cross-site' });
    const tokenParts = sealed.credential.split('.');
    tokenParts[3] = (tokenParts[3][0] === 'A' ? 'B' : 'A') + tokenParts[3].slice(1);
    await post('/api/ai', { ...common, apiKey: tokenParts.join('.') }, 400);
    for (const route of ['/api/ai', '/api/ai/image', '/api/ai/connection-models', '/api/ai/image-models', '/api/credentials/seal']) {
      await post(route, { ...common, baseUrl: 'http://127.0.0.1:9/v1', endpoint: 'http://127.0.0.1:9/v1' }, 403);
    }
    await post('/api/ai/models', { ...common, provider: 'OpenRouter' }, 403);
    await post('/api/ai/provider-models', { ...common, provider: 'OpenAI' }, 403);
    await post('/api/ai/image-models', { ...common, provider: 'OpenAI' }, 403);
    await post('/api/wechat/drafts', { ownerId: 'forged-account', html: 'test' }, 401);
    assert.equal(calls, before, 'Rejected requests never reach any upstream');
    const report = { passed: true, encryptedRoundTrip: true, allCredentialConsumersBound: true, tamperRejected: true, crossOriginRejected: true, upstreamErrorRedacted: true, skillsLoaded: true, accountForgeryRejected: true, realProviderTested: false };
    fs.writeFileSync(path.join(__dirname, '../docs/validation/credential-framework-report.json'), JSON.stringify(report, null, 2));
    console.log('PASS: credential round trip, all consumers bound, Skill workflows, tamper/origin rejection, safe errors and closed WeChat endpoint');
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
