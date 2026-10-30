import assert from 'node:assert/strict';
import { buildTextRequestBody, buildImageRequestBody, pickOpenAiImageSrc } from '../lib/ai-protocol';

export function run() {
  const base = { model: 'gpt-5', provider: 'OpenAI', adapter: 'openai-chat' as const, system: '规则', prompt: '正文', maxOutputTokens: 384 };
  const reasoning = buildTextRequestBody(base);
  assert.ok('messages' in reasoning && 'max_completion_tokens' in reasoning);
  assert.equal(reasoning.messages?.[0].role, 'developer');
  assert.equal(reasoning.max_completion_tokens, 384);
  assert.ok(!('max_tokens' in reasoning));
  const custom = buildTextRequestBody({ ...base, provider: 'Custom' });
  assert.ok('messages' in custom && 'max_tokens' in custom);
  assert.equal(custom.messages?.[0].role, 'system');
  assert.equal(custom.max_tokens, 384, 'Custom compatible servers keep their existing token parameter');
  const kimi = buildTextRequestBody({ ...base, model: 'kimi-k3', provider: 'Kimi', streaming: true });
  assert.ok('reasoning_effort' in kimi && 'max_completion_tokens' in kimi);
  assert.equal(kimi.reasoning_effort, 'low');
  assert.equal(kimi.max_completion_tokens, 384);
  assert.equal(kimi.stream, true);
  const responses = buildTextRequestBody({ ...base, adapter: 'openai-responses', image: 'data:image/png;base64,AA==', streaming: true });
  assert.equal(responses.stream, false);
  assert.equal(responses.max_output_tokens, 384);
  assert.ok(Array.isArray(responses.input));
  assert.equal(responses.input[0].content[1].image_url, 'data:image/png;base64,AA==');
  for (const [model, aspectRatio, size, generationRatio] of [
    ['dall-e-3', '2.35:1', '1792x1024', '1792:1024'],
    ['dall-e-3', '9:16', '1024x1792', '1024:1792'],
    ['dall-e-3', '1:1', '1024x1024', '1:1'],
    ['gpt-image-1', '4:3', '1536x1024', '1536:1024'],
    ['gpt-image-1', '9:16', '1024x1536', '1024:1536'],
  ]) {
    const request = buildImageRequestBody({ model, prompt: '画面', adapter: 'openai-images', aspectRatio });
    assert.ok('size' in request.body);
    assert.equal(request.body.size, size);
    assert.equal(request.generationRatio, generationRatio);
    assert.ok(!('aspect_ratio' in request.body));
  }
  const chat = buildImageRequestBody({ model: 'gemini-image', prompt: '画面', adapter: 'antigravity-gemini-image-chat', aspectRatio: '2.35:1' });
  assert.ok('image_config' in chat.body && 'modalities' in chat.body);
  assert.equal(chat.body.image_config?.aspect_ratio, '21:9');
  assert.equal(chat.generationRatio, '21:9');
  assert.deepEqual(chat.body.modalities, ['image', 'text']);
  const generic = buildImageRequestBody({ model: 'other', prompt: '画面', adapter: 'openai-images', aspectRatio: '4:3' });
  assert.ok('aspect_ratio' in generic.body);
  assert.equal(generic.body.aspect_ratio, '4:3');
  assert.equal(buildImageRequestBody({ model: 'gpt-image-1', prompt: '画面', adapter: 'openai-images' }).generationRatio, '');
  assert.equal(pickOpenAiImageSrc({ image_base64: 'AA==', mime_type: 'image/jpeg' }), 'data:image/jpeg;base64,AA==');
  assert.equal(pickOpenAiImageSrc({ image_url: { url: 'https://example.com/image.png' } }), 'https://example.com/image.png');
  assert.equal(pickOpenAiImageSrc({ image_url: {} }), '');
  console.log('PASS: shared text parameters, image adapters, ratio mapping and image response variants');
}
