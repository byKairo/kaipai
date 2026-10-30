/** Preserve upstream IDs; capability metadata takes precedence over name heuristics. */
import { modelKind } from './api-setup';
export type DiscoveryModel = { id: string; name: string; kinds: ('text' | 'image')[]; classification: 'declared' | 'inferred' | 'unknown' };
export function parseModelDirectory(payload: unknown): DiscoveryModel[] {
  const body = payload as { data?: unknown; models?: unknown } | null;
  const rows = Array.isArray(payload) ? payload : Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : null;
  if (!rows) throw new Error('服务返回的内容不是模型目录');
  const result = new Map<string, DiscoveryModel>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, any>;
    const raw = item.id ?? item.model ?? item.name;
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const id = typeof item.id === 'string' ? raw : raw.replace(/^models\//, '');
    const modalities = item.architecture?.output_modalities ?? item.output_modalities;
    const kinds: DiscoveryModel['kinds'] = [];
    if (Array.isArray(modalities)) {
      if (modalities.includes('text')) kinds.push('text');
      if (modalities.includes('image')) kinds.push('image');
    }
    const inferred = modelKind(id);
    if (!Array.isArray(modalities) && inferred !== 'other') kinds.push(inferred);
    result.set(id, { id, name: typeof item.displayName === 'string' ? item.displayName : typeof item.name === 'string' && item.id ? item.name : id, kinds, classification: Array.isArray(modalities) ? 'declared' : kinds.length || /embedding|rerank|audio|speech|tts|whisper|video|seedance|sora|veo|realtime|gpt-live|moderation|transcri/i.test(id) ? 'inferred' : 'unknown' });
  }
  return Array.from(result.values());
}
