import { listPublicationImages, type PublicationImage } from './wechat-publication';
import { escapeHtml } from './wechat-text';

const decode = (value: string) => value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const tags = /<img\b[^>]*>/gi;
const styles = /\bstyle=(["'])([\s\S]*?)\1/gi;
const cssUrls = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
function sourceAttribute(tag: string) { return /\ssrc=(["'])(.*?)\1/i.exec(tag); }
export function isStoredArticleImage(source: string, origin: string) {
  if (!/^https?:\/\//i.test(source)) return false;
  try {
    const url = new URL(source, origin);
    return url.origin === origin && !url.username && !url.password && /^\/api\/article-assets\/[a-f0-9]{64}\.(png|jpg)$/.test(url.pathname) && !url.search && !url.hash;
  } catch { return false; }
}
/** Read original resource positions; never replace an image with placeholder text. */
export function articleCopyImages(html: string, origin: string): PublicationImage[] {
  return listPublicationImages(html).filter(image => !isStoredArticleImage(image.source, origin));
}
export async function prepareArticleCopy(html: string, origin: string, upload: (source: string) => Promise<string>, signal?: AbortSignal, progress?: (done: number, total: number) => void) {
  const resources = Array.from(new Set(articleCopyImages(html, origin).map(image => image.source)));
  const urls = new Map<string, string>();
  const check = () => { if (signal?.aborted) throw new DOMException('复制已取消', 'AbortError'); };
  check();
  for (const source of resources) {
    if (!source) throw new Error('文章中有图片缺少地址，请重新插入该图片');
    check();
    const url = await upload(source);
    check();
    if (!isStoredArticleImage(url, origin)) throw new Error('图片转存未返回有效地址，请重试');
    urls.set(source, url);
    progress?.(urls.size, resources.length);
  }
  // All resources must succeed before the complete HTML is returned to the clipboard.
  const images = html.replace(tags, tag => {
    const attr = sourceAttribute(tag);
    if (!attr) return tag;
    const url = urls.get(decode(attr[2]));
    return url ? tag.replace(attr[0], ` src=${attr[1]}${escapeHtml(url)}${attr[1]}`) : tag;
  });
  return images.replace(styles, (attr, quote: string, value: string) => {
    const changed = value.replace(cssUrls, (original: string, double: string, single: string, bare: string) => {
      let source = decode(double ?? single ?? bare.trim());
      if ((source.startsWith('"') && source.endsWith('"')) || (source.startsWith("'") && source.endsWith("'"))) source = source.slice(1, -1);
      const url = urls.get(source);
      return url ? `url(&quot;${escapeHtml(url)}&quot;)` : original;
    });
    return changed === value ? attr : `style=${quote}${changed}${quote}`;
  });
}
