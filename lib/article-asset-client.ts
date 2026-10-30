import { readArticleImage } from './article-image-download';
import { isStoredArticleImage } from './article-copy-assets';
import { readResponseJson } from './response-body';

const cache = new Map<string, string>();
export async function uploadArticleAsset(source: string, signal: AbortSignal): Promise<string> {
  const blob = await readArticleImage(source, signal);
  if (signal.aborted) throw new DOMException('复制已取消', 'AbortError');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), byte => byte.toString(16).padStart(2, '0')).join('');
  const cached = cache.get(hash);
  if (cached) return cached;
  const response = await fetch('/api/article-assets', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type }, credentials: 'same-origin', signal });
  const result = await readResponseJson(response, 32768);
  if (!response.ok || !isStoredArticleImage(result.url, location.origin)) throw new Error(result.error || '图片转存失败，请重试');
  if (cache.size >= 256) cache.delete(cache.keys().next().value!);
  cache.set(hash, result.url);
  return result.url;
}
