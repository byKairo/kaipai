import assert from 'node:assert/strict';
import { limitApiRequest } from '../lib/server/rate-limit';
export async function run() {
  const keys: string[] = [];
  const deny = { async limit({ key }: { key: string }) { keys.push(key); return { success: false }; } };
  const req = (path: string, ip = '192.0.2.1', method = 'POST') => new Request('https://example.com' + path, { method, headers: { 'cf-connecting-ip': ip, 'x-forwarded-for': 'spoofed' } });
  for (const path of ['/api/ai', '/api/ai/models', '/api/ai/image', '/api/credentials/seal']) {
    const response = await limitApiRequest(req(path), deny);
    assert.equal(response?.status, 429); assert.equal(response?.headers.get('Retry-After'), '60'); assert.match(response!.headers.get('Cache-Control')!, /no-store/);
  }
  assert.equal(new Set(keys).size, 1, 'one shared counter across protected endpoints');
  assert.ok(!keys[0].includes('192.0.2.1'));
  await limitApiRequest(req('/api/ai', '192.0.2.2'), deny); assert.notEqual(keys[0], keys.at(-1));
  const count = keys.length;
  for (const path of ['/', '/_next/static/test.js', '/api/platform', '/api/ai-not-real']) assert.equal(await limitApiRequest(req(path), deny), null);
  assert.equal(await limitApiRequest(req('/api/ai', '192.0.2.1', 'GET'), deny), null);
  assert.equal(keys.length, count, 'local editing and assets never consume API quota');
  assert.equal(await limitApiRequest(req('/api/ai'), { async limit() { return { success: true }; } }), null);
  assert.equal(await limitApiRequest(req('/api/ai'), { async limit() { throw Error('unavailable'); } }), null);
  console.log('PASS: shared API counter, isolated addresses, 429 retry/no-cache, unaffected pages and fail-open platform outage');
}
