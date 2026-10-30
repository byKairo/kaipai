/** Readiness and rejection probes; no real provider key or paid model invocation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WORKSPACE_URL || 'https://kaipai.kairostudio.workers.dev';
async function main() {
  const checks = [];
  async function request(route, body, expected = 200, origin = base) {
    const response = await fetch(base + route, { ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    assert.equal(response.status, expected, `${route}: ${JSON.stringify(result)}`);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    return result;
  }
  const platform = await request('/api/platform');
  assert.equal(platform.guest.persistentCredentials, true);
  assert.ok(platform.skills.length >= 2);
  checks.push('production credential configuration and Skill versions available');
  for (const mode of ['with-text', 'wordless']) {
    const catalog = await request('/api/ai/design?mode=' + mode);
    assert.ok(catalog.ok && catalog.styles.length > 0);
  }
  checks.push('both live cover catalogues loaded');
  const article = '上线验收：保留文章和结尾。';
  const workflow = await request('/api/ai/local-workflow', { phase: 'text', operation: 'layout', article });
  assert.ok(workflow.ok && workflow.prompt.includes(article) && workflow.skills.length > 0);
  await request('/api/ai/local-workflow', { phase: 'text', operation: 'layout', article, apiKey: 'forbidden-test-only' }, 400);
  checks.push('bundled layout Skill prepares full article and rejects local API keys');
  const sealed = await request('/api/credentials/seal', { provider: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiKey: 'release-fixture-not-a-real-key' });
  assert.match(sealed.credential, /^kpcred1\./);
  assert.ok(!JSON.stringify(sealed).includes('release-fixture-not-a-real-key'));
  await request('/api/ai/provider-models', { provider: 'Gemini', apiKey: sealed.credential }, 403);
  const parts = sealed.credential.split('.'); parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
  await request('/api/ai/provider-models', { provider: 'OpenAI', apiKey: parts.join('.') }, 400);
  checks.push('production encryption works; destination mismatch and tampering refused before supplier calls');
  await request('/api/credentials/seal', { provider: 'Custom', baseUrl: 'http://127.0.0.1:9/v1', apiKey: 'test-only' }, 400);
  checks.push('production loopback exception remains disabled');
  await request('/api/credentials/seal', { provider: 'OpenAI', apiKey: 'test-only' }, 403, 'https://untrusted.test');
  await request('/api/wechat/drafts', { ownerId: 'forged', html: 'fixture' }, 401);
  checks.push('cross-origin credential request and unauthenticated publication refused');
  const report = { passed: true, url: base, checkedAt: new Date().toISOString(), realSupplierCalled: false, checks };
  const out = path.resolve('docs/validation/optimization-release-20261026');
  fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'production-smoke.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
