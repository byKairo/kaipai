import assert from 'node:assert/strict';
import { connectionRoles, savedConnectionRoles, saveConnection } from '../lib/api-connection-state';
import type { ApiProfile } from '../lib/api-profiles';
const profile = (id: string, image = true): ApiProfile => ({ id, name: id, provider: 'Custom', baseUrl: `https://${id}.example/v1`, apiKey: `${id}-sealed-credential`, models: { text: `${id}-text`, image: image ? `${id}-image` : '' }, adapters: { text: 'openai-chat', image: 'openai-images' }, modelConfigs: [{ id: `${id}-legacy-text-id`, modelId: `${id}-text`, capabilities: ['text'], displayName: id, adapter: 'openai-chat', enabled: true }, ...(image ? [{ id: `${id}-legacy-image-id`, modelId: `${id}-image`, capabilities: ['image-generation' as const], displayName: id, adapter: 'openai-images' as const, enabled: true }] : [])] });
export function run() {
  const a = profile('a'), b = profile('b');
  const original = [a];
  const two = saveConnection(original, b);
  assert.equal(original.length, 1);
  assert.equal(two.length, 2);
  assert.equal(two[0], a);
  assert.equal(two[1].apiKey, 'b-sealed-credential');
  assert.deepEqual(connectionRoles(b), { textId: 'b', imageId: 'b', textModelId: 'b-legacy-text-id', imageModelId: 'b-legacy-image-id' });
  assert.deepEqual(connectionRoles(a), { textId: 'a', imageId: 'a', textModelId: 'a-legacy-text-id', imageModelId: 'a-legacy-image-id' });
  const edited = { ...a, name: 'Renamed', baseUrl: 'https://changed.example/v1' };
  const updated = saveConnection(two, edited);
  assert.equal(updated.length, 2);
  assert.equal(updated[1], b);
  assert.equal(two[0].name, 'a');
  assert.equal(updated[1].baseUrl, 'https://b.example/v1');
  const textOnly = profile('text-only', false);
  assert.deepEqual(connectionRoles(textOnly), { textId: 'text-only', imageId: '', textModelId: 'text-only-legacy-text-id', imageModelId: undefined });
  assert.deepEqual(savedConnectionRoles(connectionRoles(a), b, false), connectionRoles(a), 'saving another connection must not activate it');
  assert.deepEqual(savedConnectionRoles(connectionRoles(a), b, true), connectionRoles(b), 'explicit activation switches both roles');
  const mixed = { textId: 'a', imageId: 'b', textModelId: 'old-text', imageModelId: 'b-image' };
  assert.deepEqual(savedConnectionRoles(mixed, a, false), { ...mixed, textModelId: 'a-legacy-text-id' }, 'saving current text connection preserves separate image connection');
  assert.equal(savedConnectionRoles(connectionRoles(a), { ...a, models: { text: a.models.text, image: '' } }, false).imageId, '', 'removed model clears its active role');
  console.log('PASS: independent connection credentials, append/update isolation, saved model switching and text-only activation');
}
