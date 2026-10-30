/**
 * Deterministic static WeChat OA compliance gate (plugin_spec §1.3).
 * Complements emit-time primitives in wechat-typography.ts.
 * Does NOT replace the official puppeteer verifier — see residual risk in smoke report.
 */

import {
  parseStyle,
  serializeStyle,
  wechatMinLineHeight,
} from './wechat-typography';

export type WechatViolation = {
  /** 1-based 「第 N 段」 style index among block shells when possible */
  index: number;
  tag: string;
  reason:
    | 'line-height-overlapping'
    | 'missing-line-height'
    | 'unitless-line-height'
    | 'height-conflict'
    | 'missing-font-size'
    | string;
  message: string;
  snippet: string;
};

const SKIP_TYPE =
  /^(img|br|hr|input|source|wbr|meta|link|col|svg|path|circle|rect|line|polyline|polygon|ellipse|use|defs|clippath|stop|lineargradient|radialgradient)$/i;

const TEXTISH =
  /^(section|p|div|h1|h2|h3|h4|h5|h6|td|th|li|blockquote|table|span|strong|em|a|ul|ol|article|header|footer|figcaption|label|button)$/i;

const BLOCK_SHELL =
  /^(section|p|div|h1|h2|h3|h4|h5|h6|td|th|li|blockquote|table|ul|ol|article)$/i;

const STYLE_TAG_RE = /<([a-zA-Z0-9]+)([^>]*?)style="([^"]*)"/g;

type LhParse = {
  kind: 'px' | 'unitless' | 'em' | 'percent' | 'other' | 'missing';
  px: number;
  raw?: string;
};

function parseFontSizePx(style: string, fallback = 16): number {
  const m = style.match(/font-size:\s*(\d+(?:\.\d+)?)px/i);
  if (m) return Number(m[1]);
  const bare = style.match(/font-size:\s*(\d+(?:\.\d+)?)(?!px|%|em|rem)/i);
  if (bare) return Number(bare[1]);
  return fallback;
}

function parseLineHeight(style: string, fontPx: number): LhParse {
  if (!/line-height\s*:/i.test(style)) return { kind: 'missing', px: 0 };
  const px = style.match(/line-height:\s*(\d+(?:\.\d+)?)px/i);
  if (px) return { kind: 'px', px: Number(px[1]), raw: px[0] };
  const pct = style.match(/line-height:\s*(\d+(?:\.\d+)?)%/i);
  if (pct) {
    return { kind: 'percent', px: Math.round((fontPx * Number(pct[1])) / 100), raw: pct[0] };
  }
  const em = style.match(/line-height:\s*(\d+(?:\.\d+)?)(em|rem)/i);
  if (em) {
    return { kind: 'em', px: Math.round(fontPx * Number(em[1])), raw: em[0] };
  }
  const unitless = style.match(/line-height:\s*(\d+(?:\.\d+)?)(?!px|%|em|rem)(;|$)/i);
  if (unitless) {
    const v = Number(unitless[1]);
    if (v > 0 && v <= 8) return { kind: 'unitless', px: Math.round(fontPx * v), raw: unitless[0] };
    return { kind: 'other', px: Math.round(v), raw: unitless[0] };
  }
  if (/line-height:\s*(normal|inherit|initial|unset)/i.test(style)) {
    return { kind: 'other', px: 0, raw: 'normal/inherit' };
  }
  return { kind: 'other', px: 0 };
}

function snippetOf(tag: string, attrs: string, style: string): string {
  const raw = `<${tag}${attrs}style="${style}"`;
  return raw.length > 160 ? `${raw.slice(0, 157)}...` : raw;
}

function isImageOnlyInner(html: string, openEnd: number): boolean {
  // Best-effort: peek until matching close is hard; look at a short window for text nodes.
  const window = html.slice(openEnd, openEnd + 400);
  const close = window.search(/<\/[a-zA-Z0-9]+>/);
  const inner = close >= 0 ? window.slice(0, close) : window;
  const withoutMedia = inner
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<(br|hr|source|input|meta|link|col)\b[^>]*\/?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '');
  return withoutMedia.trim().length === 0;
}

function stripExoticFonts(style: string): string {
  return style.replace(
    /font-family:(?![^;]*(?:Menlo|Monaco|Consolas|ui-monospace|monospace|PingFang|Microsoft YaHei|Noto Sans|Noto Serif|Songti|SimSun|Kaiti|KaiTi|FangSong|STFangsong|LXGW|Zhuque|system-ui))[^;]+;?/gi,
    '',
  );
}

/** Audit every styled tag against plugin_spec 1.3-ish static rules. */
export function auditWechatHtml(html: string): WechatViolation[] {
  const violations: WechatViolation[] = [];
  // Paragraphs and inline marks commonly repeat a style. Cache only clean
  // combinations within this audit; position and image-only context still vary.
  const cleanStyles = new Set<string>();
  let blockIndex = 0;
  const re = new RegExp(STYLE_TAG_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[1];
    const attrs = match[2] || '';
    const style = match[3] || '';
    const openEnd = match.index + match[0].length;
    if (SKIP_TYPE.test(tag)) continue;

    const imageOnly = isImageOnlyInner(html, openEnd);
    const textish = TEXTISH.test(tag);
    if (BLOCK_SHELL.test(tag)) blockIndex += 1;
    const index = BLOCK_SHELL.test(tag) ? blockIndex : Math.max(1, blockIndex);
    const styleKey = `${tag}\0${imageOnly ? 1 : 0}\0${style}`;
    if (cleanStyles.has(styleKey)) continue;
    const previousViolations = violations.length;

    const hasFs = /font-size\s*:/i.test(style);
    const fontPx = parseFontSizePx(style, 16);
    const lh = parseLineHeight(style, fontPx || 16);
    const snip = snippetOf(tag, attrs, style);

    if (textish && !hasFs && !imageOnly) {
      violations.push({
        index,
        tag,
        reason: 'missing-font-size',
        message: `缺少 font-size（将按 16px 处理）`,
        snippet: snip,
      });
    }

    if (textish && !imageOnly) {
      if (lh.kind === 'missing') {
        violations.push({
          index,
          tag,
          reason: 'missing-line-height',
          message: `缺少 line-height`,
          snippet: snip,
        });
      } else if (lh.kind === 'unitless' || lh.kind === 'em' || lh.kind === 'percent') {
        violations.push({
          index,
          tag,
          reason: 'unitless-line-height',
          message: `line-height 非 px（${lh.kind}），微信会按异常数值比较`,
          snippet: snip,
        });
      } else if (lh.kind === 'px' || lh.kind === 'other') {
        const min = wechatMinLineHeight(fontPx || 16);
        if (!lh.px || lh.px < min) {
          violations.push({
            index,
            tag,
            reason: 'line-height-overlapping',
            message: `行高 ${lh.px || 0}px < 安全下限 ${min}px（font-size ${fontPx || 16}px）`,
            snippet: snip,
          });
        }
      }
    }

    const heightMatch = style.match(/(?:^|;)\s*height:\s*([^;]+)/i);
    if (heightMatch && textish && !imageOnly && hasFs) {
      const hv = heightMatch[1].trim().toLowerCase();
      if (hv !== 'auto') {
        const hx = /^(\d+(?:\.\d+)?)px$/.exec(hv);
        if (hx && Number(hx[1]) <= 24 && Number(hx[1]) < (fontPx || 16)) {
          violations.push({
            index,
            tag,
            reason: 'height-conflict',
            message: `固定 height ${hx[1]}px 小于 font-size，可能触发文字重叠/裁切`,
            snippet: snip,
          });
        } else if (!hx && hv !== '100%' && hv !== 'auto') {
          violations.push({
            index,
            tag,
            reason: 'height-conflict',
            message: `非 px 固定 height（${hv}）在文字壳上不安全`,
            snippet: snip,
          });
        }
      }
    }
    if (violations.length === previousViolations) cleanStyles.add(styleKey);
  }
  return violations;
}

function repairOneStyle(tag: string, rawStyle: string, imageOnly: boolean): { style: string; changed: boolean } {
  let style = stripExoticFonts(String(rawStyle))
    .replace(/line-height:\s*normal;?/gi, '')
    .replace(/line-height:\s*inherit;?/gi, '')
    .replace(/font-size:\s*inherit;?/gi, '');

  const before = style;
  const skip = SKIP_TYPE.test(tag);

  const fsPeek = style.match(/font-size:\s*(\d+(?:\.\d+)?)px/i);
  const baseFs = fsPeek ? Number(fsPeek[1]) : 16;
  style = style.replace(/line-height:\s*(\d+(?:\.\d+)?)%/gi, (_m, n) => `line-height:${Math.round((baseFs * Number(n)) / 100)}px`);
  style = style.replace(/line-height:\s*(\d+(?:\.\d+)?)(em|rem);?/gi, (_m, n) => `line-height:${Math.round(baseFs * Number(n))}px`);
  style = style.replace(/line-height:\s*(\d+(?:\.\d+)?)(?!px|%|em|rem)(;|$)/gi, (_m, n, end) => {
    const v = Number(n);
    if (v > 0 && v <= 8) return `line-height:${Math.round(baseFs * v)}px${end === ';' ? ';' : ''}`;
    return `line-height:${Math.round(v)}px${end === ';' ? ';' : ''}`;
  });

  let fsMatch = style.match(/font-size:\s*(\d+(?:\.\d+)?)px/i);
  let font = fsMatch ? Number(fsMatch[1]) : 0;

  const heightMatch = style.match(/(?:^|;)\s*height:\s*([^;]+)/i);
  if (heightMatch && !skip) {
    const hv = heightMatch[1].trim().toLowerCase();
    if (hv !== 'auto') {
      const hx = /^(\d+(?:\.\d+)?)px$/.exec(hv);
      if (hx && Number(hx[1]) <= 24 && (font <= 0 || Number(hx[1]) < font)) {
        style = style.replace(/(?:^|;)\s*height:\s*[^;]*/gi, '');
      } else if (!hx) {
        style = style.replace(/(?:^|;)\s*height:\s*[^;]*/gi, '');
      }
    }
  }

  if (!skip && !imageOnly) {
    if (!font) {
      style = `font-size:16px;${style.replace(/^;/, '')}`;
      font = 16;
    }
    if (font > 0 && font < 11) {
      const bumped = 11;
      style = style.replace(/font-size:\s*\d+(?:\.\d+)?px/i, `font-size:${bumped}px`);
      font = bumped;
    }
    const minLine = wechatMinLineHeight(font);
    const lhMatch = style.match(/line-height:\s*(\d+(?:\.\d+)?)px/i);
    const line = lhMatch ? Number(lhMatch[1]) : 0;
    if (!line || line < minLine) {
      if (lhMatch) style = style.replace(/line-height:\s*\d+(?:\.\d+)?px/i, `line-height:${minLine}px`);
      else style = `${style.replace(/;?\s*$/, '')};line-height:${minLine}px`;
    }
  }

  style = style
    .replace(/line-height:\s*(\d+(?:\.\d+)?)(?!px)(;|$)/gi, '')
    .replace(/line-height:\s*(\d+(?:\.\d+)?)(%|em|rem);?/gi, '');

  if (!skip && !imageOnly) {
    const fs2 = style.match(/font-size:\s*(\d+(?:\.\d+)?)px/i);
    const font2 = fs2 ? Number(fs2[1]) : 16;
    if (!/line-height:\s*\d+(?:\.\d+)?px/i.test(style)) {
      style = `${style.replace(/;?\s*$/, '')};line-height:${wechatMinLineHeight(font2)}px`;
    }
    if (!/font-size:\s*\d+(?:\.\d+)?px/i.test(style)) {
      style = `font-size:${font2}px;${style.replace(/^;/, '')}`;
    }
  }

  style = style.replace(/;;+/g, ';').replace(/:\s+/g, ':').replace(/;\s+/g, ';').replace(/^;|;$/g, '');
  return { style, changed: style !== before };
}

/** Repair without auditing intermediate output that the caller will rewrite. */
function repairStyles(html: string): {
  html: string;
  repaired: number;
} {
  let repaired = 0;
  const styles = new Map<string, ReturnType<typeof repairOneStyle>>();
  const next = html.replace(STYLE_TAG_RE, (full, tag: string, attrs: string, raw: string, offset: number) => {
    if (SKIP_TYPE.test(tag)) return full;
    const openEnd = offset + full.length;
    const imageOnly = isImageOnlyInner(html, openEnd);
    const key = `${tag}\0${imageOnly ? 1 : 0}\0${raw}`;
    let result = styles.get(key);
    if (!result) {
      result = repairOneStyle(tag, raw, imageOnly);
      styles.set(key, result);
    }
    const { style, changed } = result;
    if (changed || style !== raw) repaired += 1;
    return `<${tag}${attrs}style="${style}"`;
  });

  // Hard guarantee: never ship inherit for font-size / line-height
  const hardened = next
    .replace(/font-size:\s*inherit/gi, 'font-size:16px')
    .replace(/line-height:\s*inherit/gi, `line-height:${wechatMinLineHeight(16)}px`);

  return { html: hardened, repaired };
}

/** Repair styled tags in place; retain the public one-pass repair/audit contract. */
export function repairWechatHtml(html: string): {
  html: string;
  repaired: number;
  remaining: WechatViolation[];
} {
  const result = repairStyles(html);
  return { ...result, remaining: auditWechatHtml(result.html) };
}

/** Repair then re-audit; ok iff remaining empty. */
export function enforceWechatCompliance(html: string): {
  html: string;
  ok: boolean;
  violations: WechatViolation[];
  repaired: number;
} {
  const first = repairStyles(html);
  // Second pass catches anything the first rewrite introduced.
  // If the first pass left the HTML unchanged, it is already a fixed point.
  const second = first.html === html ? { html, repaired: 0 } : repairStyles(first.html);
  const violations = auditWechatHtml(second.html);
  return {
    html: second.html,
    ok: violations.length === 0,
    violations,
    repaired: first.repaired + second.repaired,
  };
}

/** @deprecated Prefer enforceWechatCompliance — kept as alias for call-site clarity. */
export function sanitizeWechatStyles(html: string): string {
  return enforceWechatCompliance(html).html;
}

export { parseStyle, serializeStyle, wechatMinLineHeight };
