import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CREDENTIAL_PREFIX, canonicalCredentialEndpoint, isSealedCredential } from '../credential-format';

export class CredentialError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export type CredentialBinding = { provider?: string; baseUrl: string; workspaceId?: string };
type Payload = CredentialBinding & { version: 1; apiKey: string; createdAt: number };
type Keyring = { active: string; keys: Record<string, string> };

function keyring(): Keyring {
  try {
    const value = JSON.parse(process.env.KAIPAI_CREDENTIAL_KEYS || '') as Keyring;
    if (!value || !/^[a-zA-Z0-9_-]{1,32}$/.test(value.active) || !value.keys?.[value.active]) throw new Error();
    for (const [id, key] of Object.entries(value.keys)) {
      if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id) || typeof key !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(key) || Buffer.from(key, 'base64').length !== 32) throw new Error();
    }
    return value;
  } catch { throw new CredentialError('服务尚未配置安全保存，请联系网站维护者', 503); }
}

export function credentialsConfigured() {
  try { keyring(); return true; } catch { return false; }
}

export function sealCredential(apiKey: string, binding: CredentialBinding) {
  if (!apiKey.trim() || apiKey.length > 4096 || isSealedCredential(apiKey)) throw new CredentialError('请填写有效的原始 API Key');
  const ring = keyring();
  const iv = randomBytes(12);
  const header = `${CREDENTIAL_PREFIX}${ring.active}`;
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(ring.keys[ring.active], 'base64'), iv);
  cipher.setAAD(Buffer.from(header));
  const payload: Payload = { version: 1, apiKey: apiKey.trim(), provider: binding.provider, baseUrl: canonicalCredentialEndpoint(binding.baseUrl), workspaceId: binding.workspaceId || '', createdAt: Date.now() };
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return `${header}.${iv.toString('base64url')}.${ciphertext.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}`;
}

/** Never return the decoded payload from an HTTP handler. Bind every consumer to its actual destination. */
export function resolveCredential(value: unknown, binding: CredentialBinding): string {
  if (typeof value !== 'string') return '';
  if (!isSealedCredential(value)) {
    if (value.length > 4096) throw new CredentialError('密钥过长');
    return value.trim(); // A newly typed key may be tested before it is saved.
  }
  if (value.length > 10000) throw new CredentialError('保存的凭证无效，请重新填写 API Key');
  const ring = keyring();
  let payload: Payload;
  try {
    const parts = value.split('.');
    if (parts.length !== 5) throw new Error();
    const [, id, nonce, data, tag] = parts;
    if (!ring.keys[id] || ![nonce, data, tag].every(part => /^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
    const iv = Buffer.from(nonce, 'base64url');
    const authTag = Buffer.from(tag, 'base64url');
    if (iv.length !== 12 || authTag.length !== 16) throw new Error();
    const decipher = createDecipheriv('aes-256-gcm', Buffer.from(ring.keys[id], 'base64'), iv);
    decipher.setAAD(Buffer.from(`${CREDENTIAL_PREFIX}${id}`));
    decipher.setAuthTag(authTag);
    payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8'));
    if (payload.version !== 1 || typeof payload.apiKey !== 'string' || !payload.apiKey || payload.apiKey.length > 4096) throw new Error();
  } catch { throw new CredentialError('保存的凭证已失效或损坏，请重新填写 API Key'); }
  if (payload.baseUrl !== canonicalCredentialEndpoint(binding.baseUrl) || binding.provider && payload.provider !== binding.provider || binding.workspaceId !== undefined && payload.workspaceId !== binding.workspaceId) {
    throw new CredentialError('凭证与服务地址或业务空间不匹配，请重新填写 API Key', 403);
  }
  return payload.apiKey;
}
