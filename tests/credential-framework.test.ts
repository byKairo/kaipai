import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { CredentialError, sealCredential, resolveCredential } from '../lib/server/credential-codec';
import { API_PROFILES_KEY, readApiProfiles, writeApiProfiles, normalizeApiProfile } from '../lib/api-profiles';
import { buildSkillPlan, buildDesignPrompt } from '../lib/server/skill-workflows';
import { ownedCredential } from '../lib/server/platform-contracts';

export async function run() {
  const previous = process.env.KAIPAI_CREDENTIAL_KEYS;
  const keyA = randomBytes(32).toString('base64');
  const keyB = randomBytes(32).toString('base64');
  const binding = { provider: 'Custom', baseUrl: 'https://example.com/v1', workspaceId: 'space-a' };
  const secret = 'test-only-sensitive-value';
  try {
    delete process.env.KAIPAI_CREDENTIAL_KEYS;
    assert.throws(() => sealCredential(secret, binding), (error: unknown) => error instanceof CredentialError && error.status === 503);
    process.env.KAIPAI_CREDENTIAL_KEYS = JSON.stringify({ active: 'a', keys: { a: keyA } });
    const token = sealCredential(secret, binding);
    assert.ok(!token.includes(secret));
    assert.notEqual(token, sealCredential(secret, binding), 'Fresh nonces for identical credentials');
    assert.equal(resolveCredential(token, { ...binding, baseUrl: binding.baseUrl + '/chat/completions' }), secret);
    for (const changed of [{ baseUrl: 'https://attacker.test/v1' }, { provider: 'OpenAI' }, { workspaceId: 'space-b' }]) {
      assert.throws(() => resolveCredential(token, { ...binding, ...changed }), (error: unknown) => error instanceof CredentialError && error.status === 403);
    }
    const parts = token.split('.');
    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);
    assert.throws(() => resolveCredential(parts.join('.'), binding), CredentialError);
    assert.throws(() => resolveCredential('kpcred1.garbage', binding), CredentialError);
    process.env.KAIPAI_CREDENTIAL_KEYS = JSON.stringify({ active: 'b', keys: { a: keyA, b: keyB } });
    assert.equal(resolveCredential(token, binding), secret, 'Rotation retains existing credentials while old key exists');
    process.env.KAIPAI_CREDENTIAL_KEYS = JSON.stringify({ active: 'b', keys: { b: keyB } });
    assert.throws(() => resolveCredential(token, binding), CredentialError);

    const data = new Map<string, string>();
    const session = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({ getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) });
    const localDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const sessionDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage(data) });
    Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage(session) });
    try {
      const profile = normalizeApiProfile({ id: 'a', provider: 'Custom', apiKey: token, baseUrl: binding.baseUrl, model: 'test' })!;
      const roles = { textId: profile.id, imageId: '' };
      assert.throws(() => writeApiProfiles([{ ...profile, apiKey: secret }], roles), /尚未加密/);
      session.set('kaipai.community.api-profiles.v3', 'legacy');
      writeApiProfiles([profile], roles);
      assert.ok(!data.get(API_PROFILES_KEY)!.includes(secret));
      assert.equal(session.size, 0);
      session.clear(); // A new browser tab/session must not lose persistent profiles.
      assert.equal(readApiProfiles().profiles[0].apiKey, token);
      writeApiProfiles([], { textId: '', imageId: '' });
      assert.equal(readApiProfiles().profiles.length, 0);
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { ...storage(data), setItem: () => { throw new Error('Quota'); } } });
      assert.throws(() => writeApiProfiles([profile], roles), /无法保存/);
    } finally {
      if (localDescriptor) Object.defineProperty(globalThis, 'localStorage', localDescriptor); else Reflect.deleteProperty(globalThis, 'localStorage');
      if (sessionDescriptor) Object.defineProperty(globalThis, 'sessionStorage', sessionDescriptor); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    }

    const article = '开头\n' + '正文。'.repeat(8000) + '\n重要的结尾';
    const layout = buildSkillPlan({ operation: 'layout', article });
    assert.equal(JSON.parse(layout.prompt).article, article, 'Never silently truncate long articles');
    assert.deepEqual(layout.skills.map(item => item.name), ['kairo-layout']);
    assert.match(layout.system, /只排版/);
    assert.match(layout.system, /代码和表格/);
    const review = buildSkillPlan({ operation: 'review', article });
    assert.equal(JSON.parse(review.prompt).article, article);
    assert.deepEqual(review.skills.map(item => item.name), ['kairo-layout']);
    assert.match(review.system, /原文与建议分开/);
    assert.match(review.system, /只生成网站正文旁的简短建议/);
    assert.match(review.system, /不处理代码、链接或配置/);
    assert.match(review.system, /不生成完整改稿/);
    assert.deepEqual(buildSkillPlan({ operation: 'images', article: '短文' }).skills.map(item => item.name), ['kairo-design']);
    assert.match(buildDesignPrompt('torn-photo-collage 封面'), /撕纸拼贴/);
    assert.throws(() => buildSkillPlan({ operation: '../../secrets', article: 'x' }), CredentialError);
    assert.throws(() => buildSkillPlan({ operation: 'layout', article: 'x'.repeat(40001) }), CredentialError);
    const record = { id: '1', ownerId: 'alice', provider: 'Custom', baseUrl: binding.baseUrl, credential: token };
    const repository = { find: async () => record, save: async () => {}, remove: async () => {} };
    assert.equal(await ownedCredential(repository, { userId: 'bob', displayName: 'Bob' }, '1'), null);
    assert.equal(await ownedCredential(repository, { userId: 'alice', displayName: 'Alice' }, '1'), record);
    console.log('PASS: encrypted credentials, destination binding, rotation, local persistence, Skill boundaries and account ownership');
  } finally {
    if (previous === undefined) delete process.env.KAIPAI_CREDENTIAL_KEYS; else process.env.KAIPAI_CREDENTIAL_KEYS = previous;
  }
}
