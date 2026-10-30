import assert from 'node:assert/strict';
import { localAiFetch } from '../lib/local-ai-client';
export async function run() {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const key = 'test-secret-only';
  const base = 'http://127.0.0.1:18317/v1';
  globalThis.fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init });
    if (url === '/api/ai/local-workflow') {
      assert.ok(!String(init?.body).includes(key));
      assert.ok(!String(init?.body).includes(base));
      return Response.json({ ok: true, prompt: 'prepared prompt', system: 'prepared system' });
    }
    if (url === 'http://127.0.0.1:18317/') return Response.json({ message: 'other local server' });
    assert.ok(url.startsWith(base));
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${key}`);
    assert.equal(init?.redirect, 'manual');
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'gpt-local' }] });
    if (url.endsWith('/responses')) return Response.json({ output_text: 'responses result' });
    if (url.endsWith('/images/generations')) return Response.json({ data: [{ b64_json: 'aGVsbG8=' }] });
    return Response.json({ choices: [{ message: { content: 'chat result' } }] });
  };
  try {
    const body = { apiKey: key, baseUrl: base, model: 'gpt-local' };
    assert.equal((await (await localAiFetch('/api/ai/connection-models', body)).json()).models[0].id, 'gpt-local');
    assert.equal((await (await localAiFetch('/api/ai', { ...body, operation: 'layout', article: '文章' })).json()).text, 'chat result');
    assert.equal((await (await localAiFetch('/api/ai', { ...body, adapter: 'openai-responses', action: 'test' })).json()).text, 'responses result');
    assert.equal((await (await localAiFetch('/api/ai/image', { ...body, action: 'test', prompt: 'test' })).json()).ok, true);
    await localAiFetch('/api/ai', { ...body, provider: 'OpenAI', model: 'gpt-5', action: 'test' });
    const reasoningRequest = JSON.parse(String(calls[calls.length - 1].init?.body));
    assert.equal(reasoningRequest.messages[0].role, 'developer');
    assert.equal(reasoningRequest.max_completion_tokens, 384);
    assert.ok(!('max_tokens' in reasoningRequest));
    const dallE = await (await localAiFetch('/api/ai/image', { ...body, model: 'dall-e-3', aspectRatio: '9:16', prompt: 'test' })).json();
    const imageRequest = JSON.parse(String(calls[calls.length - 1].init?.body));
    assert.equal(imageRequest.size, '1024x1792');
    assert.ok(!('aspect_ratio' in imageRequest));
    assert.equal(dallE.generationRatio, '1024:1792');
    assert.ok(calls.every(call => !call.url.includes(':3003')));
    const count = calls.length;
    await assert.rejects(localAiFetch('/api/ai', { ...body, apiKey: 'kpcred1.old' }), /重新填写一次/);
    assert.equal(calls.length, count, 'Old ciphertext must never be sent upstream');
    globalThis.fetch = async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: 'partial' } }] });
    await assert.rejects(localAiFetch('/api/ai', { ...body, action: 'test' }), /回复中断或被截断/);
    globalThis.fetch = async () => Response.json({ status: 'incomplete', output_text: 'partial' });
    await assert.rejects(localAiFetch('/api/ai', { ...body, adapter: 'openai-responses', action: 'test' }), /回复中断或被截断/);
    globalThis.fetch = async () => new Response('', { status: 401 });
    await assert.rejects(localAiFetch('/api/ai', { ...body, action: 'test' }), /Key 无效/);
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(localAiFetch('/api/ai', { ...body, action: 'test' }), /跨域访问/);
    await assert.rejects(localAiFetch('/api/ai', { ...body, baseUrl: 'https://example.com/v1' }), /仅用于本机/);
    for (const path of ['/api/ai/connection-models', '/api/ai/image']) {
      let cancelled = false;
      globalThis.fetch = async input => String(input).endsWith('/')
        ? Response.json({ message: 'unrelated server' })
        : new Response(new ReadableStream({
          start(controller) { controller.enqueue(new Uint8Array(64)); },
          cancel() { cancelled = true; },
        }), { headers: { 'content-type': 'application/json', 'content-length': String(40 * 1024 * 1024) } });
      await assert.rejects(localAiFetch(path, { ...body, action: 'test', prompt: 'test' }), /返回的数据过大/);
      assert.ok(cancelled, 'oversized local responses stop reading before JSON allocation');
    }
  } finally { globalThis.fetch = original; }
  console.log('PASS: local discovery, chat, responses, images, credential isolation, old-key migration, errors');
}
