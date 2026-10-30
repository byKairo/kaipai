import assert from 'node:assert/strict';
import { localAuthHeader, localPermissionState, localConnectionFailure } from '../lib/local-api-access';
import { localAiFetch } from '../lib/local-ai-client';

export async function run() {
  const originalFetch = globalThis.fetch;
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const baseUrl = 'http://127.0.0.1:18318/v1';
  const key = 'test-only-local-key';
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let failPost = false;
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { permissions: { async query() { throw new TypeError('unsupported'); } } } });
    globalThis.fetch = async (input, init) => {
      const url = String(input); calls.push({ url, init });
      assert.equal((init as RequestInit & { targetAddressSpace: string }).targetAddressSpace, 'loopback');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.redirect, 'manual');
      if (url === 'http://127.0.0.1:18318/') {
        assert.equal(new Headers(init?.headers).has('Authorization'), false, 'server identification cannot send credentials');
        assert.equal(new Headers(init?.headers).has('X-Api-Key'), false);
        assert.equal(init?.body, undefined);
        return Response.json({ message: 'CLI Proxy API Server', endpoints: ['GET /v1/models', 'POST /v1/chat/completions'] });
      }
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('X-Api-Key'), key, 'recognized CLIProxyAPI uses its documented browser-compatible header');
      assert.equal(headers.has('Authorization'), false, 'wildcard CORS does not permit Authorization');
      if (url.endsWith('/models')) return Response.json({ data: [{ id: 'local-text' }] });
      if (failPost) throw new TypeError('Failed to fetch');
      return Response.json({ choices: [{ message: { content: 'connected' } }] });
    };
    const signal = new AbortController().signal;
    assert.equal(await localAuthHeader(baseUrl, signal), 'X-Api-Key');
    assert.equal((await (await localAiFetch('/api/ai/connection-models', { baseUrl, apiKey: key })).json()).models[0].id, 'local-text');
    assert.equal((await (await localAiFetch('/api/ai', { baseUrl, apiKey: key, model: 'local-text', action: 'test' })).json()).text, 'connected');
    failPost = true;
    const posts = calls.filter(call => call.init?.method === 'POST').length;
    await assert.rejects(localAiFetch('/api/ai', { baseUrl, apiKey: key, model: 'local-text', action: 'test' }), /未能连接本机 API/);
    assert.equal(calls.filter(call => call.init?.method === 'POST').length, posts + 1, 'ambiguous failures must never replay a potentially billed request');
    const before = calls.length;
    await assert.rejects(localAuthHeader('https://example.com/v1', signal), /仅用于/);
    assert.equal(calls.length, before, 'identification never probes a public host');
    globalThis.fetch = async () => Response.json({ message: 'unrelated server' });
    assert.equal(await localAuthHeader(baseUrl, signal), 'Authorization', 'generic OpenAI-compatible servers keep Bearer authentication');
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { permissions: { async query() { return { state: 'denied' }; } } } });
    assert.equal(await localPermissionState(), 'denied');
    assert.match((await localConnectionFailure()).message, /浏览器已禁止/);
    globalThis.fetch = async () => { throw new Error('denied permission must not send a credential'); };
    await assert.rejects(localAiFetch('/api/ai', { baseUrl, apiKey: key, model: 'local-text', action: 'test' }), /浏览器已禁止/);
  } finally {
    globalThis.fetch = originalFetch;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
  console.log('PASS: loopback address declaration, CLIProxyAPI CORS/auth compatibility, credential-free identification, permission diagnosis and no billed retries');
}
