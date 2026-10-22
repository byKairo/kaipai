import assert from 'node:assert/strict';
import { identifyApiAddress, modelKind, recommendModels } from '../lib/api-setup';
export function run() {
  assert.deepEqual(identifyApiAddress(' https://www.whatstoken.ai/v1/chat/completions '), { baseUrl: 'https://www.whatstoken.ai/v1', provider: 'Custom' });
  assert.equal(identifyApiAddress('https://www.whatstoken.ai').baseUrl, 'https://www.whatstoken.ai/v1');
  assert.equal(identifyApiAddress('http://127.0.0.1:8317/v1/responses').baseUrl, 'http://127.0.0.1:8317/v1');
  assert.equal(identifyApiAddress('https://generativelanguage.googleapis.com').baseUrl, 'https://generativelanguage.googleapis.com/v1beta/openai');
  assert.equal(identifyApiAddress('https://api.openai.com/v1').provider, 'OpenAI');
  assert.throws(() => identifyApiAddress('https://example.com/v1?key=private'), /查询参数/);
  assert.throws(() => identifyApiAddress('https://name:password@example.com/v1'), /密钥/);
  const list = ['gemini-3.8-flash', 'gpt-image-2.5-flare', 'gpt-embedding', 'unknown-model', 'veo-video'].map(id => ({ id, name: id }));
  assert.deepEqual(recommendModels(list, { text: '', image: '' }), { text: 'gemini-3.8-flash', image: 'gpt-image-2.5-flare' });
  assert.deepEqual(recommendModels(list, { text: 'my-custom-text', image: 'my-custom-image' }), { text: 'my-custom-text', image: 'my-custom-image' });
  assert.deepEqual(recommendModels([], { text: '', image: '' }), { text: '', image: '' });
  assert.equal(modelKind('gemini-3.1-flash-image'), 'image');
  assert.equal(modelKind('qwen-embedding'), 'other');
  console.log('PASS: API address normalization, credential boundary, model recommendations and existing selections preserved');
}
