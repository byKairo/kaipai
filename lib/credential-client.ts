import type { ApiProfile } from './api-profiles';
import { isSealedCredential } from './credential-format';

export async function protectApiProfile(profile: ApiProfile): Promise<ApiProfile> {
  const response = await fetch('/api/credentials/seal', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
    body: JSON.stringify({ provider: profile.provider, baseUrl: profile.baseUrl, workspaceId: profile.workspaceId || '', apiKey: profile.apiKey }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok || !isSealedCredential(body.credential)) throw new Error(body?.error || '安全保存失败，请重试');
  return { ...profile, apiKey: body.credential };
}

/** Migrate older per-tab profiles only after all credentials have been sealed successfully. */
export async function restoreApiProfiles() {
  const { readApiProfiles, normalizeApiProfile } = await import('./api-profiles');
  const saved = readApiProfiles();
  if (!saved.profiles.length) {
    const legacy = sessionStorage.getItem('kaipai.community.byok');
    if (legacy) {
      const old = JSON.parse(legacy);
      if (old.textApiKey && old.apiProvider !== '本地模拟') {
        const profile = normalizeApiProfile({ id: crypto.randomUUID(), provider: old.apiProvider, apiKey: old.textApiKey, baseUrl: old.textBaseUrl, model: old.apiModel, imageModel: old.imageApiKey === old.textApiKey ? old.imageModel : '' });
        if (profile) { saved.profiles.push(profile); saved.roles = { textId: profile.id, imageId: profile.models.image ? profile.id : '' }; }
      }
    }
  }
  saved.profiles = await Promise.all(saved.profiles.map(profile => isSealedCredential(profile.apiKey) ? profile : protectApiProfile(profile)));
  return saved;
}
