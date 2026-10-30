import { modelKind } from './api-setup';
import type { DiscoveryModel } from './model-discovery';
export const REFERENCE_SOURCES = {
  OpenAI: { url: 'https://developers.openai.com/api/docs/models', pattern: /^(?:gpt-[\w.-]+|o[1-9][\w.-]*|chatgpt-image-latest)$/, snapshot: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-image-2.5-sunburst', 'gpt-image-2.5-flare', 'gpt-image-2'] },
  Anthropic: { url: 'https://platform.claude.com/docs/en/models/overview', pattern: /^claude-(?:opus|sonnet|haiku|fable)-[\d][\w.-]*$/, snapshot: ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] },
  Gemini: { url: 'https://ai.google.dev/gemini-api/docs/models?hl=en', pattern: /^gemini-\d[\w.-]*$/, snapshot: ['gemini-3.1-flash-image', 'gemini-3-pro-image'] },
  DeepSeek: { url: 'https://api-docs.deepseek.com/quick_start/pricing/', pattern: /^deepseek-[\w.-]+$/, snapshot: ['deepseek-flash'] },
  Qwen: { url: 'https://help.aliyun.com/zh/model-studio/models', pattern: /^(?:qwen|qwq|wanx)[\w.-]+$/, snapshot: [] },
  Kimi: { url: 'https://www.kimi.ai/help/kimi-api/api-model-selection', pattern: /^(?:kimi|moonshot)-[\w.-]+$/, snapshot: [] },
  Grok: { url: 'https://docs.x.ai/developers/models', pattern: /^grok-[\w.-]+$/, snapshot: ['grok-imagine-image-2.0'] },
};
export type ReferenceProvider = keyof typeof REFERENCE_SOURCES;
export const IMAGE_REFERENCE_SOURCES: Partial<Record<ReferenceProvider, string>> = {
  Gemini: 'https://ai.google.dev/gemini-api/docs/image-generation?hl=en',
  Grok: 'https://docs.x.ai/developers/model-capabilities/imagine',
};
export function referenceModels(ids: string[]): DiscoveryModel[] {
  return Array.from(new Set(ids)).map(id => ({ id, name: id, kinds: modelKind(id) === 'other' ? [] : [modelKind(id) as 'text' | 'image'], classification: 'inferred' }));
}
/** Only documented code tokens and model-page links; no invented aliases from display names. */
export function extractReferenceModels(html: string, provider: ReferenceProvider) {
  const cleaned = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const candidates = Array.from(cleaned.matchAll(/<code\b[^>]*>([\s\S]*?)<\/code>/gi)).flatMap(match => match[1].replace(/<[^>]+>/g, '').split(/[\s"'<>`,;=(){}\[\]]+/));
  if (provider === 'OpenAI') candidates.push(...Array.from(cleaned.matchAll(/\/api\/docs\/models\/([\w.-]+)/g)).map(match => match[1]));
  if (provider === 'Anthropic') candidates.push(...Array.from(cleaned.matchAll(/aria-label="Copy model ID (claude-[\w.-]+)"/g)).map(match => match[1]));
  if (provider === 'Qwen') candidates.push(...Array.from(html.matchAll(/https:\/\/bailian\.console\.aliyun\.com\/[^"\s\\<>]*\/model\/market\/detail\/([\w.-]+)/g)).map(match => match[1]));
  return referenceModels(candidates.filter(id => REFERENCE_SOURCES[provider].pattern.test(id)));
}
