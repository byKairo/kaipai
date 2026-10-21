/** Browser-side OG/title extract for 往期推荐 — no heavy deps. */

export type LinkMeta = {
  title: string;
  image: string;
  href: string;
};

function pickMicrolink(data: unknown, fallbackUrl: string): LinkMeta | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const title = String(obj.title || obj.ogTitle || '').trim();
  const imageRaw = obj.image;
  let image = '';
  if (typeof imageRaw === 'string') image = imageRaw;
  else if (imageRaw && typeof imageRaw === 'object' && 'url' in imageRaw) {
    image = String((imageRaw as { url?: unknown }).url || '');
  }
  if (!image) image = String(obj.ogImage || '');
  const href = String(obj.url || fallbackUrl).trim() || fallbackUrl;
  if (title || image) return { title: title || fallbackUrl, image: image.trim(), href };
  return null;
}

function attrFromHtml(html: string, prop: string): string {
  const a = html.match(new RegExp(`property=["']${prop}["']\\s+content=["']([^"']+)["']`, 'i'));
  const b = html.match(new RegExp(`content=["']([^"']+)["']\\s+property=["']${prop}["']`, 'i'));
  const c = html.match(new RegExp(`name=["']${prop}["']\\s+content=["']([^"']+)["']`, 'i'));
  return (a && a[1]) || (b && b[1]) || (c && c[1]) || '';
}

/** Microlink often returns a proxied screenshot/CDN URL that browsers can load (unlike raw mmbiz). */
function pickMicrolinkImage(data: Record<string, unknown>): string {
  const imageRaw = data.image;
  if (typeof imageRaw === 'string' && imageRaw.trim()) return imageRaw.trim();
  if (imageRaw && typeof imageRaw === 'object') {
    const o = imageRaw as { url?: unknown; proxy?: unknown };
    if (typeof o.url === 'string' && o.url.trim()) return o.url.trim();
  }
  // logo / screenshot as last resort for cards
  const logo = data.logo;
  if (typeof logo === 'string' && logo.trim()) return logo.trim();
  if (logo && typeof logo === 'object' && typeof (logo as { url?: unknown }).url === 'string') {
    return String((logo as { url: string }).url).trim();
  }
  return String(data.ogImage || '').trim();
}

function refineMicrolink(data: unknown, fallbackUrl: string): LinkMeta | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  const title = String(obj.title || obj.ogTitle || '').trim();
  const image = pickMicrolinkImage(obj);
  const href = String(obj.url || fallbackUrl).trim() || fallbackUrl;
  if (title || image) return { title: title || fallbackUrl, image, href };
  return null;
}

/** Prefer microlink (better cover URLs); fall back to allorigins + og tags. */
export async function extractLinkMeta(url: string): Promise<LinkMeta> {
  const href = url.trim();
  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(href)}&palette=false&audio=false&video=false&iframe=false`);
    const j = (await r.json()) as { data?: unknown; status?: string };
    const got = refineMicrolink(j?.data, href) || pickMicrolink(j?.data, href);
    if (got && got.title) return got;
  } catch {
    /* continue */
  }
  try {
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(href)}`);
    const html = await r.text();
    const title =
      attrFromHtml(html, 'og:title') ||
      (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] ||
      '';
    let image = attrFromHtml(html, 'og:image') || attrFromHtml(html, 'twitter:image') || '';
    // Raw mmbiz CDN often shows WeChat hotlink placeholder in browser preview;
    // keep URL (referrerpolicy=no-referrer on <img> helps) but prefer https.
    if (image.startsWith('//')) image = `https:${image}`;
    return {
      title: title.replace(/\s+/g, ' ').trim() || href,
      image: image.trim(),
      href,
    };
  } catch {
    return { title: href, image: '', href };
  }
}

const RECS_BLOCK_RE = /:::(?:recs|recommendations)\s*\n[\s\S]*?\n:::/;

/** Replace existing :::recs / :::recommendations block, or append at end. */
export function upsertRecsBlock(md: string, block: string): string {
  const trimmedBlock = block.trim();
  if (RECS_BLOCK_RE.test(md)) return md.replace(RECS_BLOCK_RE, trimmedBlock);
  return `${md.replace(/\s*$/, '')}\n\n${trimmedBlock}\n`;
}

export function parseRecUrls(raw: string): string[] {
  return raw
    .split(/[\s,，]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

/** Build `:::recs` markdown from meta rows (cover may be empty). */
export function buildRecsBlock(rows: Array<{ title: string; image?: string; href: string }>): string {
  const lines = rows.map((r) => {
    const title = (r.title || r.href).replace(/\s*\|\s*/g, '·').trim();
    const cover = (r.image || '').trim();
    const href = (r.href || '').trim();
    return `${title} | ${cover} | ${href}`;
  });
  return `:::recs\n${lines.join('\n')}\n:::`;
}
