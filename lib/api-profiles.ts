import { isSealedCredential } from './credential-format';
import type { AiProviderId } from './providers';

export type ModelCapability = 'text' | 'image-generation' | 'vision' | 'embedding' | 'video-generation' | 'audio' | 'speech';
export type ProtocolAdapter = 'openai-chat' | 'openai-responses' | 'openai-images' | 'gemini-native' | 'antigravity-gemini-image-chat';
export type ApiModelConfig = { id: string; modelId: string; displayName: string; capabilities: ModelCapability[]; adapter: ProtocolAdapter; enabled: boolean };

export type ApiProfile = {
  id: string;
  name: string;
  provider: AiProviderId;
  apiKey: string;
  baseUrl: string;
  models: { text: string; image: string; vision?: string; embedding?: string; video?: string };
  adapters: { text: 'openai-chat' | 'openai-responses'; image: 'openai-images' | 'gemini-native' | 'antigravity-gemini-image-chat' };
  modelConfigs: ApiModelConfig[];
  workspaceId?: string;
};

export type ApiProfileRoles = { textId: string; imageId: string; textModelId?: string; imageModelId?: string };

export const API_PROFILES_KEY = 'kaipai.community.api-profiles.v4';
export const LEGACY_API_KEYS = ['kaipai.community.api-profiles.v3','kaipai.community.api-profiles.v2', 'kaipai.community.api-profiles.v1'];

export function defaultImageAdapter(provider: AiProviderId, baseUrl: string, model: string): ApiProfile['adapters']['image'] {
  if (provider === 'Gemini' && baseUrl.includes('generativelanguage.googleapis.com')) return 'gemini-native';
  if (/^gemini-.*image/i.test(model)) return 'antigravity-gemini-image-chat';
  return 'openai-images';
}

export function normalizeApiProfile(item: Record<string, unknown>): ApiProfile | null {
  if (typeof item.id !== 'string' || typeof item.apiKey !== 'string' || typeof item.provider !== 'string') return null;
  const legacy = item as { endpoint?: string; model?: string; imageModel?: string };
  const models = item.models && typeof item.models === 'object' ? item.models as Record<string, unknown> : {};
  const baseUrl = typeof item.baseUrl === 'string' ? item.baseUrl : legacy.endpoint || '';
  const image = typeof models.image === 'string' ? models.image : (Array.isArray(item.modelConfigs) ? (item.modelConfigs as ApiModelConfig[]).find((entry) => entry?.capabilities?.includes('image-generation'))?.modelId : '') || legacy.imageModel || '';
  const adapters = item.adapters && typeof item.adapters === 'object' ? item.adapters as Record<string, unknown> : {};
  const storedConfigs = Array.isArray(item.modelConfigs) ? item.modelConfigs as ApiModelConfig[] : [];
  const text = typeof models.text === 'string' ? models.text : storedConfigs.find((entry) => entry?.capabilities?.includes('text'))?.modelId || legacy.model || '';
  const textAdapter = adapters.text === 'openai-responses' ? 'openai-responses' : 'openai-chat';
  const imageAdapter = adapters.image === 'openai-images' || adapters.image === 'gemini-native' || adapters.image === 'antigravity-gemini-image-chat' ? adapters.image : defaultImageAdapter(item.provider as AiProviderId, baseUrl, image);
  const configs = Array.isArray(item.modelConfigs) ? item.modelConfigs.filter((entry): entry is ApiModelConfig => Boolean(entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.modelId === 'string' && Array.isArray(entry.capabilities) && typeof entry.adapter === 'string')).map((entry) => ({ ...entry, enabled: entry.enabled !== false })) : [];
  if (!configs.length) {
    if (text) configs.push({ id: `${item.id}:text`, modelId: text, displayName: text, capabilities: ['text'], adapter: textAdapter, enabled: true });
    if (image) configs.push({ id: `${item.id}:image`, modelId: image, displayName: image, capabilities: ['image-generation'], adapter: imageAdapter, enabled: true });
  }
  return { id: item.id, name: typeof item.name === 'string' ? item.name : item.provider, provider: item.provider as AiProviderId, apiKey: item.apiKey,
    baseUrl: baseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/$/, ''),
    models: { text, image,
      ...(typeof models.vision === 'string' ? { vision: models.vision } : {}), ...(typeof models.embedding === 'string' ? { embedding: models.embedding } : {}), ...(typeof models.video === 'string' ? { video: models.video } : {}) },
    adapters: { text: textAdapter, image: imageAdapter }, modelConfigs: configs,
    workspaceId: typeof item.workspaceId === 'string' ? item.workspaceId : undefined };
}

export function readApiProfiles(): { profiles: ApiProfile[]; roles: ApiProfileRoles } {
  try {
    const current = localStorage.getItem(API_PROFILES_KEY);
    const raw = JSON.parse(current || LEGACY_API_KEYS.map((key) => sessionStorage.getItem(key)).find(Boolean) || '{}');
    const loaded: ApiProfile[] = Array.isArray(raw.profiles) ? raw.profiles.map((item: Record<string, unknown>) => normalizeApiProfile(item)).filter((item: ApiProfile | null): item is ApiProfile => item !== null) : [];
    const roles: ApiProfileRoles = { textId: typeof raw.roles?.textId === 'string' ? raw.roles.textId : '', imageId: typeof raw.roles?.imageId === 'string' ? raw.roles.imageId : '', textModelId: typeof raw.roles?.textModelId === 'string' ? raw.roles.textModelId : undefined, imageModelId: typeof raw.roles?.imageModelId === 'string' ? raw.roles.imageModelId : undefined };
    if (current) {
      roles.textModelId ||= loaded.find((item) => item.id === roles.textId)?.modelConfigs.find((model) => model.capabilities.includes('text'))?.id;
      roles.imageModelId ||= loaded.find((item) => item.id === roles.imageId)?.modelConfigs.find((model) => model.capabilities.includes('image-generation'))?.id;
      return { profiles: loaded, roles };
    }
    const profiles: ApiProfile[] = [];
    for (const item of loaded) {
      const match = profiles.find((profile) => profile.provider === item.provider && profile.baseUrl === item.baseUrl && profile.apiKey === item.apiKey);
      if (!match) { profiles.push(item); continue; }
      match.models.text ||= item.models.text;
      if (!match.models.image && item.models.image) { match.models.image = item.models.image; match.adapters.image = item.adapters.image; }
      match.modelConfigs.push(...item.modelConfigs.filter((config) => !match.modelConfigs.some((existing) => existing.modelId === config.modelId && existing.adapter === config.adapter)));
      if (roles.textId === item.id) roles.textId = match.id;
      if (roles.imageId === item.id) roles.imageId = match.id;
    }
    roles.textModelId ||= profiles.find((item) => item.id === roles.textId)?.modelConfigs.find((model) => model.capabilities.includes('text'))?.id;
    roles.imageModelId ||= profiles.find((item) => item.id === roles.imageId)?.modelConfigs.find((model) => model.capabilities.includes('image-generation'))?.id;
    return { profiles, roles };
  } catch { throw new Error('无法读取已保存的 API 配置；原数据未删除'); }
}

export function writeApiProfiles(profiles: ApiProfile[], roles: ApiProfileRoles) {
  if (profiles.some(profile => !isSealedCredential(profile.apiKey))) throw new Error('配置尚未加密，未写入浏览器');
  try { localStorage.setItem(API_PROFILES_KEY, JSON.stringify({ profiles, roles })); } catch { throw new Error('浏览器无法保存配置，请检查存储权限或剩余空间'); }
  // Persistence succeeded. Session cleanup failure must not falsely report an unsaved profile.
  try { for (const key of [...LEGACY_API_KEYS, 'kaipai.community.byok']) sessionStorage.removeItem(key); } catch { /* restrictive browsers may disable session storage */ }
}
