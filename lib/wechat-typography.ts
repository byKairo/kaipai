/**
 * WeChat OA typography primitives (plugin_spec §1.3 line-height).
 * Spec: https://developers.weixin.qq.com/doc/subscription/guide/product/plugin_spec.html
 * Official verifier: https://github.com/wechatjs/verify-article-structure-spec
 *
 * Rule: multi-line text + numeric line-height < font-size → 「行高小于字体大小…可能重叠」.
 * Hard floor used at emit time: max(ceil(fs*1.8), fs+10) px — always emit both as px.
 */

export type StyleDict = Record<string, string | number | undefined>;

/** WeChat-safe min LH in px: max(ceil(fs*1.8), fs+10) */
export function wechatMinLineHeight(fontSizePx: number): number {
  const fs = Math.max(1, Number(fontSizePx) || 16);
  return Math.max(Math.ceil(fs * 1.8), fs + 10);
}

/** Always emit both as px. Never unitless/em/%. */
export function wechatTextStyle(fontSizePx: number, extra?: string): string {
  const n = Math.max(1, Math.round(Number(fontSizePx) || 16));
  const base = `font-size:${n}px;line-height:${wechatMinLineHeight(n)}px`;
  if (extra == null || extra === '') return base;
  const cleaned = String(extra).replace(/^;+|;+$/g, '').trim();
  return cleaned ? `${base};${cleaned}` : base;
}

/** Parse inline style string → dict (last wins for duplicate keys). */
export function parseStyle(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!style) return out;
  for (const part of String(style).split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim().toLowerCase();
    const value = trimmed.slice(colon + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

/** Serialize style dict → compact inline style string. */
export function serializeStyle(styles: StyleDict): string {
  const parts: string[] = [];
  for (const [key, raw] of Object.entries(styles)) {
    if (raw == null || raw === '') continue;
    const value = typeof raw === 'number' ? String(raw) : String(raw).trim();
    if (!value) continue;
    parts.push(`${key.replace(/\s+/g, '').toLowerCase()}:${value}`);
  }
  return parts.join(';');
}

/**
 * Merge style dict → string; if font-size present (or injected), force safe line-height px
 * unless imageOnly (image-splice shells may keep tight LH).
 */
export function wechatBox(
  styles: StyleDict,
  opts?: { imageOnly?: boolean },
): string {
  const dict = { ...styles };
  const imageOnly = Boolean(opts?.imageOnly);

  const fsRaw = dict['font-size'] ?? dict.fontSize;
  let fontPx = 0;
  if (typeof fsRaw === 'number') {
    fontPx = fsRaw;
  } else if (typeof fsRaw === 'string') {
    const m = fsRaw.trim().match(/^(\d+(?:\.\d+)?)px$/i);
    if (m) fontPx = Number(m[1]);
    else if (/^\d+(?:\.\d+)?$/.test(fsRaw.trim())) fontPx = Number(fsRaw.trim());
  }

  if (!imageOnly) {
    if (!fontPx || fontPx < 1) {
      fontPx = 16;
      dict['font-size'] = '16px';
    } else {
      dict['font-size'] = `${Math.round(fontPx)}px`;
    }
    // Drop any prior LH so we never leave unitless/em/% through.
    delete dict['line-height'];
    delete dict.lineHeight;
    dict['line-height'] = `${wechatMinLineHeight(fontPx)}px`;
  } else if (fontPx > 0) {
    dict['font-size'] = `${Math.round(fontPx)}px`;
  }

  // Normalize numeric shorthand keys that callers may pass.
  if (dict.fontSize != null) {
    delete dict.fontSize;
  }
  if (dict.lineHeight != null) {
    delete dict.lineHeight;
  }

  return serializeStyle(dict);
}
