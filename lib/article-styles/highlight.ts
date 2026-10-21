import { findStyle } from '../styles';
import { contrastRatio, inkOn, paletteForArticle, resolveMarkStyles } from './palette';

// The existing default value doubles as automatic mode, preserving saved articles.
export const AUTO_MARKER = '#fff07a';

/** Shared by article output, editor marks and the component preview. */
export function resolveArticleHighlight(styleId: string, marker = AUTO_MARKER, paper?: string, textColor?: string) {
    const style = findStyle(styleId);
    const auto = marker.toLowerCase() === AUTO_MARKER;
    const requested = auto ? style.colors.mark : marker;
    const background = paper || style.paper;
    const skin = auto && style.design === 'pixel' && /^#[\da-f]{6}$/i.test(requested)
        ? { bg: requested, color: inkOn(requested) } : resolveMarkStyles(requested, background);
    let mode: 'half' | 'full' = ['neo', 'pixel'].includes(style.design) ? 'full' : 'half';
    let color = skin.color;
    if (mode === 'half') {
        // Half-height marks need readable ink on both the paper and the color band.
        const candidates = ['#1a1a1a', '#f5f5f5'];
        color = candidates.sort((a, b) =>
            Math.min(contrastRatio(b, background), contrastRatio(b, skin.bg)) -
            Math.min(contrastRatio(a, background), contrastRatio(a, skin.bg)))[0];
        if (Math.min(contrastRatio(color, background), contrastRatio(color, skin.bg)) < 4.5) {
            mode = 'full'; color = skin.color;
        }
    }
    // Keep the article's warm/cool ink when it remains legible on the entire mark.
    const preferredInk = textColor || paletteForArticle(styleId, background).ink;
    if (/^#[\da-f]{6}$/i.test(preferredInk) && contrastRatio(preferredInk, skin.bg) >= 4.5 &&
        (mode === 'full' || contrastRatio(preferredInk, background) >= 4.5)) {
        color = preferredInk;
    }
    const backgroundImage = mode === 'half'
        ? `linear-gradient(transparent 52%,${skin.bg} 52%,${skin.bg} 92%,transparent 92%)` : 'none';
    const backgroundColor = mode === 'half' ? 'transparent' : skin.bg;
    const padding = mode === 'half' ? '0 2px' : '1px 4px';
    // Solid fallback for clients that discard gradients; all text retains explicit typography.
    const css = `background-color:${skin.bg};${mode === 'half' ? `background:${backgroundImage};` : ''}color:${color};padding:${padding};box-decoration-break:clone;-webkit-box-decoration-break:clone;`;
    return { auto, bg: skin.bg, color, mode, backgroundColor, backgroundImage, padding, css };
}
