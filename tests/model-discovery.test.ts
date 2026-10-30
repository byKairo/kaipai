import assert from 'node:assert/strict';
import { parseModelDirectory } from '../lib/model-discovery';
import { extractReferenceModels } from '../lib/reference-models';
import { isLocalApi } from '../lib/ai-transport';
import { bridgeOriginAllowed } from '../lib/bridge-origin';
export function run() {
  assert.equal(isLocalApi('http://localhost:8317/v1'), true);
  assert.equal(isLocalApi('https://api.openai.com/v1'), false);
  const models = parseModelDirectory({ data: [
    { id: 'private-long-id-' + 'a'.repeat(200), architecture: { output_modalities: ['image'] } },
    { id: 'custom-foo', name: 'My model' }, { id: 'gpt-image-2.5-flare', architecture: { output_modalities: ['text'] } },
    { id: 'gpt-6.1-sol' }, { id: 'gpt-6.1-sol' }, { id: 123 }, null,
  ] });
  assert.equal(models.length, 4);
  assert.equal(models[0].id.length, 216);
  assert.deepEqual(models[0].kinds, ['image']);
  assert.equal(models[1].classification, 'unknown');
  assert.equal(models[1].name, 'My model');
  assert.deepEqual(models[2].kinds, ['text']);
  assert.equal(parseModelDirectory({ models: [{ name: 'models/gemini-3.1-flash-image', displayName: 'Nano Banana' }] })[0].id, 'gemini-3.1-flash-image');
  assert.equal(parseModelDirectory({ models: [{ model: 'llama3:latest' }] })[0].id, 'llama3:latest');
  assert.throws(() => parseModelDirectory({ error: 'bad' }), /不是模型目录/);
  assert.deepEqual(extractReferenceModels('<script><code>gpt-fake</code></script><code>gpt-6.1-sol</code><a href="/api/docs/models/gpt-image-2.5-flare">Image</a>', 'OpenAI').map(m => m.id), ['gpt-6.1-sol', 'gpt-image-2.5-flare']);
  const allowed = 'https://kaipai.kairostudio.workers.dev';
  const headers = new Headers({ host: '127.0.0.1:3003', origin: allowed, 'sec-fetch-site': 'cross-site' });
  assert.equal(bridgeOriginAllowed(headers, true, allowed), true);
  assert.equal(bridgeOriginAllowed(headers, false, allowed), false);
  assert.equal(bridgeOriginAllowed(headers, true, 'https://evil.example'), false);
  headers.set('host', 'evil.example'); assert.equal(bridgeOriginAllowed(headers, true, allowed), false);
  headers.set('host', '127.0.0.1:3003'); headers.set('origin', allowed + '.evil.example'); assert.equal(bridgeOriginAllowed(headers, true, allowed), false);
  console.log('PASS: upstream IDs, metadata precedence, unknown models, reference sources, bridge routing and origin isolation');
}
