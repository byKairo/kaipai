import { findStyle } from '../styles';

export type Palette = {
    paper: string;
    ink: string;
    muted: string;
    surface: string;
    line: string;
    quote: string;
};

/** Use the style's coordinated neutrals on its paper (and on WeChat white). */
export function paletteForArticle(styleId: string, paper: string): Palette {
    const style = findStyle(styleId);
    const { text: ink, muted, surface, line, quote } = style.colors;
    if (paper.toLowerCase() === style.paper.toLowerCase() || (!isDarkPaper(style.paper) && isPureWhitePaper(paper))) {
        const safeMuted = style.preset && [paper,surface,quote].some(bg=>contrastRatio(muted,bg)<4.5) ? ink : muted;
        return { paper, ink, muted:safeMuted, surface, line, quote };
    }
    // A custom paper may invert the required contrast; retain the existing fallback.
    return { paper, ...tokensForPaper(paper) };
}
/**
 * Build WeChat-safe article HTML.
 * Spec: https://developers.weixin.qq.com/doc/service/guide/product/plugin_spec.html
 * - no <pre> (section + white-space:pre-wrap + word-break)
 * - no font-family overrides
 * - every text node uses explicit px font-size AND larger px line-height (never inherit)
 * - no fixed widths that overflow mobile
 */
/** Typography + compliance: see lib/wechat-typography.ts and lib/wechat-compliance.ts.
 *  Emit via wechatTextStyle / wechatBox; final gate is enforceWechatCompliance (replaces ad-hoc sanitize).
 */
/** True for pure white papers WeChat already provides — no need to force a locked bg. */
export function isPureWhitePaper(hex: string): boolean {
    const raw = hex.trim().replace(/^#/, '').toLowerCase();
    if (!raw)
        return true;
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    return full === 'ffffff';
}
/** Relative luminance (sRGB) for contrast decisions. */
export function hexLuminance(hex: string): number {
    const raw = hex.trim().replace(/^#/, '');
    const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
    if (!/^[0-9a-fA-F]{6}$/.test(full))
        return 1;
    const channel = (value: number) => {
        const s = value / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const r = channel(parseInt(full.slice(0, 2), 16));
    const g = channel(parseInt(full.slice(2, 4), 16));
    const b = channel(parseInt(full.slice(4, 6), 16));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** True only for genuinely dark papers (pixelpost / custom dark). */
export function isDarkPaper(hex: string): boolean {
    return hexLuminance(hex) < 0.45;
}
/** WCAG-ish contrast ratio between two hex colors. */
export function contrastRatio(a: string, b: string): number {
    const L1 = hexLuminance(a);
    const L2 = hexLuminance(b);
    const lighter = Math.max(L1, L2);
    const darker = Math.min(L1, L2);
    return (lighter + 0.05) / (darker + 0.05);
}
/** Ink that reads on a given solid background (pick higher contrast). */
export function inkOn(bg: string): string {
    const light = '#f5f5f5';
    const dark = '#1a1a1a';
    return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark;
}
/**
 * Fluorescent mark: bg must contrast with paper; text must contrast with bg.
 * Never pale wash under light glyphs on dark paper.
 */
export function resolveMarkStyles(marker: string, paper: string): {
    bg: string;
    color: string;
} {
    let bg = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(marker.trim()) ? marker.trim() : '#ffe566';
    if (isDarkPaper(paper)) {
        // Pale pastels (cyan/yellow/mint) wash out on black — deepen to solid emphasis.
        if (hexLuminance(bg) > 0.5 || contrastRatio(bg, paper) < 2.2) {
            const raw = bg.replace(/^#/, '').toLowerCase();
            const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
            const r = parseInt(full.slice(0, 2), 16);
            const g = parseInt(full.slice(2, 4), 16);
            const b = parseInt(full.slice(4, 6), 16);
            // Cool pastels → deep teal; warm pastels → deep amber.
            bg = b >= r && b >= g ? '#0e7490' : g >= r ? '#047857' : '#b45309';
        }
        return { bg, color: inkOn(bg) };
    }
    // Light paper: classic fluorescent, always dark ink on the wash.
    if (hexLuminance(bg) < 0.4)
        bg = '#ffe566';
    return { bg, color: '#1a1a1a' };
}
/** Footer / CTA accent that stays readable on white (avoid neon wash). */
export function readableAccent(accent: string): string {
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(accent.trim()))
        return '#c45a00';
    if (hexLuminance(accent) > 0.35) {
        // Bright orange/cyan → clamp into readable brand range
        const raw = accent.replace(/^#/, '').toLowerCase();
        const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        if (r > 180 && g > 80 && b < 120)
            return '#c45a00';
        if (b > r && b > g)
            return '#0e7490';
        return '#1a1a1a';
    }
    return accent.trim();
}
/** Accent used as TEXT on paper — aim ≥ ~3:1; else readableAccent / ink. */
export function accentTextOnPaper(accent: string, paper: string, fallbackInk: string): string {
    const a = accent.trim();
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(a))
        return fallbackInk;
    if (contrastRatio(a, paper) >= 3)
        return a;
    // On dark paper, darkening accents hurts — fall back to light ink.
    if (isDarkPaper(paper))
        return fallbackInk;
    const readable = readableAccent(a);
    if (contrastRatio(readable, paper) >= 3)
        return readable;
    return fallbackInk;
}
/** Pick readable ink (+ muted/surface tokens) for a given paper. */
export function tokensForPaper(paper: string): Omit<Palette, 'paper'> {
    if (isDarkPaper(paper)) {
        return {
            ink: '#e8fff6',
            muted: '#a9c8c2',
            surface: '#121d27',
            line: '#315b58',
            quote: '#172334',
        };
    }
    return {
        ink: '#202124',
        muted: '#58615e',
        surface: '#f4f7f6',
        line: '#d5dfdb',
        quote: '#f2f7f5',
    };
}
