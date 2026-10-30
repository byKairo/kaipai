import assert from 'node:assert/strict';
import { RESPONSE_LIMITS } from '../lib/response-body';
import * as endpoints from '../lib/server-endpoint';
import { CredentialError } from '../lib/server/credential-codec';

export async function run() {
  const Module = require('node:module');
  const originalLoad = Module._load, originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout;
  const names = ['connection-models', 'models', 'provider-models', 'image-models', 'image'] as const;
  type RouteName = typeof names[number];
  const files = new Map(names.map(name => [name, require.resolve(`../app/api/ai/${name}/route`)]));
  const requestFile = require.resolve('../lib/server/request');
  const previousCache = new Map([...Array.from(files.values()), requestFile].map(file => [file, require.cache[file]]));
  for (const file of Array.from(previousCache.keys())) delete require.cache[file];
  const routeFiles = new Set(files.values());
  const fakeKey = 'upstream-routes-test-only';
  const baseUrl = 'https://upstream.invalid/v1';
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let upstream: (url: string, init: RequestInit) => Promise<Response> = async () => { throw new Error('Unexpected upstream request'); };
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let timerId = 0;
  const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve(); };
  Module._load = function(request: string, parent: any, ...rest: any[]) {
    if (request === 'server-only') return {};
    if (routeFiles.has(parent?.filename)) {
      if (request === '../../../../lib/server/credentials') return { CredentialError, resolveCredential: () => fakeKey };
      if (request === '../../../../lib/server-endpoint') return {
        ...endpoints,
        async capabilityEndpoint(base: string, path: string) { assert.equal(base, baseUrl); return `${base}/${path}`; },
        async validateImageDownload() { throw new Error('Base64 test images must not trigger an external download'); },
      };
      if (request === '../../../../lib/server/skills') return { buildDesignPrompt() { throw new Error('Connection tests must not run a design workflow'); } };
    }
    return originalLoad.call(this, request, parent, ...rest);
  };
  globalThis.fetch = async (input, init) => {
    assert.ok(init?.signal, 'Every upstream route must attach its deadline signal');
    assert.equal(init.redirect, 'manual');
    const url = String(input); calls.push({ url, init });
    return upstream(url, init);
  };
  // Capture real route deadlines without waiting twelve seconds or using a network socket.
  globalThis.setTimeout = ((callback: () => void, delay: number) => {
    const id = ++timerId; timers.set(id, { callback, delay }); return id;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((id: number) => { timers.delete(id); }) as unknown as typeof clearTimeout;
  try {
    const { NextRequest } = require('next/server');
    const routes = Object.fromEntries(names.map(name => [name, require(files.get(name)!).POST])) as Record<RouteName, (request: unknown) => Promise<Response>>;
    const invoke = (name: RouteName, body: Record<string, unknown>) => routes[name](new NextRequest(`https://kaipai.test/api/ai/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://kaipai.test' }, body: JSON.stringify(body),
    }));
    const bodyFor = (name: RouteName): Record<string, unknown> => name === 'connection-models' ? { baseUrl, apiKey: 'fake-credential' }
      : name === 'models' ? { query: 'text' }
      : name === 'provider-models' ? { provider: 'OpenAI', apiKey: 'fake-credential' }
      : name === 'image-models' ? { provider: 'Custom', baseUrl, apiKey: 'fake-credential' }
      : { provider: 'Custom', baseUrl, apiKey: 'fake-credential', model: 'image-test', prompt: '连接测试', action: 'test', adapter: 'openai-images' };

    const directory = Array.from({ length: 140 }, (_, index) => ({ id: `vendor/model:${index}-original`, name: `Model ${index}` }));
    directory.push({ id: 'unfamiliar-capability-id', name: 'Unknown capability' });
    upstream = async () => Response.json({ data: directory });
    let response = await invoke('connection-models', bodyFor('connection-models'));
    assert.equal(response.status, 200);
    const complete = await response.json();
    assert.equal(complete.source, 'connection');
    assert.deepEqual(complete.models.map((model: { id: string }) => model.id), directory.map(model => model.id), 'Connection discovery must preserve every original ID beyond legacy display limits');
    assert.equal(calls.at(-1)!.url, `${baseUrl}/models`);
    assert.equal(timers.size, 0);

    const oversized = async (name: RouteName, limit: number, body: Record<string, unknown> = bodyFor(name)) => {
      let cancelled = false;
      upstream = async () => new Response(new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode('private-provider-body-must-not-leak')); },
        cancel() { cancelled = true; },
      }), { headers: { 'Content-Type': 'application/json', 'Content-Length': String(limit + 1) } });
      const result = await invoke(name, body);
      assert.equal(result.status, 502, `${name} must reject oversized upstream JSON`);
      const payload = await result.json();
      assert.deepEqual(payload, { ok: false, error: '模型服务返回的数据过大，请缩小输出后重试' });
      assert.ok(!JSON.stringify(payload).includes('private-provider-body'));
      assert.ok(cancelled, `${name} must release the oversized response`);
      assert.equal(timers.size, 0);
    };
    await oversized('connection-models', RESPONSE_LIMITS.models);
    await oversized('image-models', RESPONSE_LIMITS.models);
    await oversized('models', RESPONSE_LIMITS.models);
    await oversized('provider-models', RESPONSE_LIMITS.models);

    // Preserve the existing public catalogue's metadata and vendor-specific schemas.
    upstream = async () => Response.json({ data: [{ id: 'vendor/free-model', name: 'Free model', description: '说明', context_length: 128000, pricing: { prompt: '0', completion: '0' } }] });
    response = await invoke('models', bodyFor('models'));
    assert.deepEqual((await response.json()).models, [{ id: 'vendor/free-model', name: 'Free model', description: '说明', context: 128000, free: true }]);
    const providerCases = [
      { provider: 'OpenAI', payload: { data: [{ id: 'gpt-5', created: 2 }, { id: 'gpt-image-1', created: 3 }] }, ids: ['gpt-5'] },
      { provider: 'Anthropic', payload: { data: [{ id: 'claude-test', display_name: 'Claude test' }] }, ids: ['claude-test'] },
      { provider: 'Gemini', payload: { models: [{ name: 'models/gemini-test', displayName: 'Gemini test', supportedGenerationMethods: ['generateContent'] }, { name: 'models/gemini-test-image', supportedGenerationMethods: ['generateContent'] }] }, ids: ['gemini-test'] },
      { provider: 'Qwen', payload: { output: { models: [{ model: 'qwen-test', inference_metadata: { response_modality: ['Text'] } }] } }, ids: ['qwen-test'] },
      { provider: 'Grok', payload: { models: [{ id: 'grok-test' }, { id: 'grok-image-test' }] }, ids: ['grok-test'] },
      { provider: 'DeepSeek', payload: { data: [{ id: 'deepseek-test' }] }, ids: ['deepseek-test'] },
      { provider: 'Kimi', payload: { data: [{ id: 'kimi-test' }] }, ids: ['kimi-test'] },
    ];
    for (const test of providerCases) {
      upstream = async () => Response.json(test.payload);
      response = await invoke('provider-models', { provider: test.provider, workspaceId: 'test-workspace', apiKey: 'fake-credential' });
      assert.equal(response.status, 200, test.provider);
      assert.deepEqual((await response.json()).models.map((model: { id: string }) => model.id), test.ids, `${test.provider} catalogue parsing is retained`);
    }
    const imageCatalogues = [
      { provider: 'Custom', payload: { data: [{ id: 'unfamiliar', architecture: { output_modalities: ['image'] } }, { id: 'flux-test' }, { id: 'text-only' }] }, ids: ['unfamiliar', 'flux-test'] },
      { provider: 'OpenAI', payload: { data: [{ id: 'gpt-image-1' }, { id: 'dall-e-3' }, { id: 'gpt-5' }] }, ids: ['gpt-image-1', 'dall-e-3'] },
      { provider: 'Gemini', payload: { models: [{ name: 'models/gemini-image-test', supportedGenerationMethods: ['generateContent'] }] }, ids: ['gemini-image-test'] },
      { provider: 'Grok', payload: { models: [{ id: 'grok-imagine-image-test' }] }, ids: ['grok-imagine-image-test'] },
      { provider: 'OpenRouter', payload: { data: [{ id: 'vendor/image-model' }] }, ids: ['vendor/image-model'] },
    ];
    for (const test of imageCatalogues) {
      upstream = async () => Response.json(test.payload);
      response = await invoke('image-models', { provider: test.provider, baseUrl, apiKey: 'fake-credential' });
      assert.equal(response.status, 200, test.provider);
      assert.deepEqual((await response.json()).models.map((model: { id: string }) => model.id), test.ids);
    }

    for (const name of ['models', 'provider-models', 'image-models'] as const) {
      let signal: AbortSignal | undefined, bodyStarted = false;
      upstream = async (_url, init) => {
        signal = init.signal!;
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('{"data":['));
            signal!.addEventListener('abort', () => controller.error(new DOMException('Private upstream timeout detail', 'AbortError')), { once: true });
          },
          pull() { bodyStarted = true; },
        }), { headers: { 'Content-Type': 'application/json' } });
      };
      const pending = invoke(name, bodyFor(name));
      await settle();
      assert.ok(bodyStarted && signal, `${name} must be waiting on an already-started response body`);
      assert.equal(timers.size, 1, `${name} must not clear its deadline after receiving only headers`);
      const timer = Array.from(timers.values())[0];
      assert.equal(timer.delay, 12000); timer.callback();
      const result = await pending;
      assert.ok(signal.aborted);
      assert.equal(result.status, 504);
      const payload = await result.json();
      assert.match(payload.error, /超时/);
      assert.ok(!payload.error.includes('Private upstream'));
      assert.equal(timers.size, 0);
    }

    // An official paginated directory shares one aggregate budget across all pages.
    const padding = ' '.repeat(6 * 1024 * 1024);
    let pages = 0, lastPageCancelled = false;
    upstream = async () => {
      pages++;
      if (pages <= 2) return new Response(JSON.stringify({ models: [{ name: `models/gemini-page-${pages}` }], nextPageToken: `page-${pages + 1}`, padding }));
      return new Response(new ReadableStream({ cancel() { lastPageCancelled = true; } }), { headers: { 'Content-Length': String(6 * 1024 * 1024) } });
    };
    response = await invoke('connection-models', { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: 'fake-credential' });
    assert.equal(response.status, 502);
    assert.equal(pages, 3); assert.ok(lastPageCancelled);
    assert.deepEqual(await response.json(), { ok: false, error: '模型服务返回的数据过大，请缩小输出后重试' });

    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQ1sAAAAASUVORK5CYII=';
    for (const adapter of ['openai-images', 'antigravity-gemini-image-chat', 'gemini-native']) {
      const native = adapter === 'gemini-native';
      const body = { ...bodyFor('image'), adapter, provider: native ? 'Gemini' : 'Custom', baseUrl: native ? 'https://generativelanguage.googleapis.com/v1beta/openai' : baseUrl };
      upstream = async () => Response.json(native ? { candidates: [{ content: { parts: [{ inlineData: { data: png, mimeType: 'image/png' } }] } }] }
        : adapter === 'openai-images' ? { data: [{ b64_json: png }] } : { choices: [{ message: { images: [{ image_base64: png, media_type: 'image/png' }] } }] });
      response = await invoke('image', body);
      assert.equal(response.status, 200, adapter);
      assert.deepEqual(await response.json(), { ok: true, model: 'image-test' }, 'Image tests retain their existing small success contract');
      await oversized('image', RESPONSE_LIMITS.image, body);
    }
    assert.equal(timers.size, 0);
    console.log('PASS: real route handlers preserve catalogues/image adapters, reject oversized bodies, bound cumulative pages and retain body-read deadlines');
  } finally {
    Module._load = originalLoad; globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout; globalThis.clearTimeout = originalClearTimeout;
    for (const [file, cached] of Array.from(previousCache)) { delete require.cache[file]; if (cached) require.cache[file] = cached; }
  }
}
