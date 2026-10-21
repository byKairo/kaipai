import { wechatTextStyle, wechatMinLineHeight } from '../wechat-typography';
import { escapeHtml } from '../wechat-text';
import { SAMPLE_IMAGE } from './sample-image';
import { readableAccent, hexLuminance, accentTextOnPaper, inkOn, type Palette } from './palette';
import { renderCallout, renderComparison, type Theme, type InlineRenderer } from './elements';
import type { WechatReadingOptions } from '../wechat-html';
export type ComponentContext = {
    accent: string;
    business: boolean;
    chipInk: string;
    corp: boolean;
    darkPaper: boolean;
    editorial: boolean;
    edu: boolean;
    isEvent: boolean;
    isFestival: boolean;
    isOpinion: boolean;
    knowledge: boolean;
    neo: boolean;
    neoInk: string;
    neoShadow: (n?: number) => string;
    palette: Palette;
    pink: string;
    pixel: boolean;
    reading: WechatReadingOptions;
    research: boolean;
    styleId: string;
    tech: boolean;
    techDark: string;
    techHeroInk: string;
    techSoft: string;
    inline: InlineRenderer;
};
/** Pure component rendering: no document, clipboard, storage or DOM access. */
export function renderComponent(kind: string, body: string[], theme: Theme, context: ComponentContext): string {
    const { accent, business, chipInk, corp, darkPaper, editorial, edu, isEvent, isFestival, isOpinion, knowledge, neo, neoInk, neoShadow, palette, pink, pixel, reading, research, styleId, tech, techDark, techHeroInk, techSoft, inline } = context;
    const output: string[] = [];
    // `inner` for follow/recs is built ad hoc; callout boxes build `boxedInner` with box-local ink.
    if (kind === 'compare') {
        const rawLines = body.map((l) => l.trim()).filter(Boolean);
        let compareTitle = '对比';
        let conclusion = '';
        const rows: {
            tag: string;
            name: string;
            note: string;
        }[] = [];
        for (const raw of rawLines) {
            const titleMatch = raw.match(/^(?:标题|题目|对比)[:：]\s*(.+)$/);
            if (titleMatch) {
                compareTitle = titleMatch[1].trim();
                continue;
            }
            const conclMatch = raw.match(/^(?:结论|总结|Verdict)[:：]\s*(.+)$/i);
            if (conclMatch) {
                conclusion = conclMatch[1].trim();
                continue;
            }
            const parts = raw.split(/\s*[|｜]\s*/).map((p) => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                rows.push({
                    tag: parts[0],
                    name: parts[1],
                    note: parts.slice(2).join(' · ') || '',
                });
            }
            else if (parts.length === 1 && rows.length < 4) {
                rows.push({ tag: String.fromCharCode(65 + rows.length), name: parts[0], note: '' });
            }
        }
        return renderComparison(theme, compareTitle, rows, conclusion, inline);
    }
    if (kind === 'follow') {
        const [variant = 'minimal', title = '关注我们', copy = '持续分享真正有用的内容', cta = '关注公众号', media = '', href = ''] = body.join('\n').split('|');
        const known = ['minimal', 'brand', 'card', 'neo', 'qr', 'avatar', 'split', 'account'].includes(variant)
            ? variant
            : 'minimal';
        const useNeoFollow = known === 'neo' || (known === 'minimal' && neo);
        // Tech / business card follow: light corporate card (never dark body chrome)
        const useTechCardFollow = (tech || business) && (known === 'card' || known === 'minimal');
        const useEduFollow = edu && (known === 'minimal' || known === 'card');
        const followBrandInk = hexLuminance(accent) > 0.42 ? '#1a1a1a' : '#ffffff';
        const followEdge = readableAccent(accent);
        const followDarkBg = darkPaper ? palette.surface : palette.ink;
        const followDarkInk = inkOn(followDarkBg);
        const visual = known === 'brand'
            ? `background-color:${accent};color:${followBrandInk};border:0`
            : useTechCardFollow
                ? `background-color:${palette.surface};color:${palette.ink};border:1px solid ${followEdge};border-radius:${business ? '6px' : '10px'};${tech ? techSoft : 'box-shadow:0 4px 12px rgba(27,59,104,.08)'}`
                : useEduFollow
                    ? `background-color:${palette.surface};color:${palette.ink};border:1px solid ${palette.line};border-radius:8px`
                    : known === 'card'
                        ? `background-color:${palette.surface};color:${palette.ink};border:1px solid ${palette.line};border-radius:12px`
                        : useNeoFollow
                            ? `background-color:${accent};color:${neoInk};border:3px solid ${neoInk};${neoShadow(5)}`
                            : known === 'qr'
                                ? `background-color:${followDarkBg};color:${followDarkInk};border-left:5px solid ${followEdge}`
                                : known === 'avatar'
                                    ? `background-color:${palette.surface};color:${palette.ink};border:1px solid ${palette.line};border-radius:14px`
                                    : known === 'split'
                                        ? `background-color:${palette.surface};color:${palette.ink};border:1px solid ${palette.line}`
                                        : known === 'account'
                                            ? `background-color:${followDarkBg};color:${followDarkInk};border:1px solid ${palette.line};border-radius:8px`
                                            : pixel
                                                ? `background-color:${palette.surface};color:${palette.ink};border:1px solid ${palette.line}`
                                                : `background-color:${palette.paper};color:${palette.ink};border-top:2px solid ${followEdge};border-bottom:2px solid ${followEdge}`;
        const badge = known === 'qr'
            ? '▦ QR'
            : known === 'avatar'
                ? '● 作者'
                : known === 'split'
                    ? '▧ 图文'
                    : known === 'account'
                        ? '◎ 公众号'
                        : useNeoFollow
                            ? '＋ 关注'
                            : useTechCardFollow
                                ? business
                                    ? 'BRIEF'
                                    : 'SIGNAL'
                                : useEduFollow
                                    ? '继续学'
                                    : known === 'brand'
                                        ? corp
                                            ? '品牌'
                                            : '关注'
                                        : title;
        const mediaSource = media.startsWith('sample://') ? SAMPLE_IMAGE : media;
        const mediaHtml = mediaSource
            ? `<img src="${escapeHtml(mediaSource)}" alt="" referrerpolicy="no-referrer" style="display:block;width:42px;height:42px;max-width:100%;object-fit:cover;border-radius:50%;margin:0 0 9px;border:1px solid rgba(255,255,255,.25)">`
            : known === 'qr' || known === 'account'
                ? `<span style="display:inline-block;width:42px;height:42px;text-align:center;border-radius:8px;background-color:${followDarkBg};color:${followDarkInk};${wechatTextStyle(16)};font-weight:800;margin:0 0 9px;border:1px solid ${palette.line}">▦</span>`
                : '';
        const ctaColor = useNeoFollow ? neoInk : known === 'qr' || known === 'account' ? followDarkInk : known === 'brand' ? followBrandInk : pixel ? palette.ink : followEdge;
        const ctaHtml = /^https?:\/\//.test(href)
            ? `<a href="${escapeHtml(href)}" style="display:inline-block;color:${ctaColor};${wechatTextStyle(12)};font-weight:800;text-decoration:underline">${inline(cta, 12, 22)} →</a>`
            : `<span style="display:inline-block;${wechatTextStyle(12)};font-weight:800">${inline(cta, 12, 22)} →</span>`;
        const followMargin = useNeoFollow ? '18px 8px 18px 0' : '18px 0';
        output.push(`<section style="margin:${followMargin};padding:15px 16px;box-sizing:border-box;max-width:100%;${visual}">${mediaHtml}<p style="margin:0 0 7px;${wechatTextStyle(11)};font-weight:800;letter-spacing:.09em">${inline(badge, 11, 20)}</p><p style="margin:0 0 5px;${wechatTextStyle(16)};font-weight:800">${inline(title, 16, 28)}</p><p style="margin:0 0 11px;${wechatTextStyle(13)}">${inline(copy, 13, 22)}</p>${ctaHtml}</section>`);
        return output.join('');
    }
    if (kind === 'recommendations') {
        const recTitleLine = body.find((row) => row.startsWith('@title:'));
        const recStyleLine = body.find((row) => row.startsWith('@style:'));
        const recTitle = (recTitleLine?.slice(7).trim() || '往期推荐').slice(0, 40);
        const recStyle = recStyleLine?.slice(7).trim() || 'strip';
        type RecItem = {
            title: string;
            cover: string;
            href: string;
        };
        const parseRecLine = (raw: string): RecItem | null => {
            const parts = raw.split(/\s*[|｜]\s*/).map((p) => p.trim()).filter(Boolean);
            if (!parts.length)
                return null;
            if (parts.length === 1) {
                const only = parts[0];
                return /^https?:\/\//i.test(only)
                    ? { title: only, cover: '', href: only }
                    : { title: only, cover: '', href: '' };
            }
            if (parts.length >= 3) {
                const href = /^https?:\/\//i.test(parts[parts.length - 1]) ? parts[parts.length - 1] : '';
                const cover = parts[1];
                return { title: parts[0], cover: cover === href ? '' : cover, href };
            }
            // Exactly 2 parts: legacy title|href OR title|cover
            const second = parts[1];
            if (/^https?:\/\//i.test(second))
                return { title: parts[0], cover: '', href: second };
            return { title: parts[0], cover: second, href: '' };
        };
        const items = body.filter((row) => !row.startsWith('@')).map(parseRecLine).filter((x): x is RecItem => Boolean(x && x.title));
        if (recStyle === 'strip' || recStyle === 'plain') {
            const stripItems = items.map((item) => {
                const href = /^https?:\/\//i.test(item.href) ? item.href : '';
                const cover = item.cover.startsWith('sample://') ? SAMPLE_IMAGE : item.cover;
                const imageStyle = recStyle === 'strip' && cover ? `background-image:linear-gradient(90deg,rgba(0,0,0,.68),rgba(0,0,0,.20)),url('${escapeHtml(cover)}');background-size:cover;background-position:center;` : '';
                const content = `<span style="display:block;min-height:56px;padding:14px 16px;box-sizing:border-box;${imageStyle}background-color:${recStyle === 'plain' || !cover ? palette.quote : '#333333'};color:${recStyle === 'plain' || !cover ? palette.ink : '#ffffff'};${wechatTextStyle(14)};font-weight:800;line-height:24px;max-width:100%">${inline(item.title, 14, 24)} →</span>`;
                return href ? `<a href="${escapeHtml(href)}" style="display:block;margin:0 0 7px;text-decoration:none;color:inherit">${content}</a>` : `<section style="margin:0 0 7px">${content}</section>`;
            }).join('');
            output.push(`<section style="margin:18px 0;max-width:100%;box-sizing:border-box"><p style="margin:0 0 8px;color:${accentTextOnPaper(accent, palette.paper, palette.ink)};${wechatTextStyle(13)};font-weight:800">${escapeHtml(recTitle)}</p>${stripItems || '<p>还没有推荐文章</p>'}</section>`);
            return output.join('');
        }
        const recAccent = readableAccent(accent);
        const resolveCover = (cover: string) => (cover.startsWith('sample://') ? SAMPLE_IMAGE : cover);
        const few = items.length > 0 && items.length <= 2;
        const thumbFamily = ['knowledge', 'edu', 'business', 'corp'].includes(styleId);
        const magazine = styleId === 'editorial' || styleId === 'research';
        const fest = styleId === 'event' || styleId === 'festival';
        const opinion = styleId === 'opinion';
        const labelHtml = (() => {
            if (neo) {
                return `<p style="margin:0 0 10px;display:inline-block;padding:4px 8px;border:3px solid ${neoInk};background-color:${accent};color:${neoInk};${wechatTextStyle(12)};font-weight:900;letter-spacing:.06em;${neoShadow(3)};box-sizing:border-box">往期推荐</p>`;
            }
            if (tech) {
                return `<p style="margin:0 0 10px;${wechatTextStyle(12)};font-weight:800;letter-spacing:.12em;color:${accent}">相关阅读</p>`;
            }
            if (pixel) {
                return `<p style="margin:0 0 10px;padding:4px 8px;border-left:3px solid ${accent};background-color:${palette.surface};color:${accent};${wechatTextStyle(12)};font-weight:800;letter-spacing:.1em;box-sizing:border-box">延伸阅读</p>`;
            }
            if (magazine) {
                return `<p style="margin:0 0 4px;${wechatTextStyle(11)};font-weight:700;letter-spacing:.2em;color:${recAccent}">RECOMMENDED</p><p style="margin:0 0 12px;${wechatTextStyle(18)};font-weight:800;letter-spacing:.12em;color:${palette.ink}">往期推荐</p>`;
            }
            return `<p style="margin:0 0 10px;${wechatTextStyle(12)};font-weight:800;letter-spacing:.08em;color:${recAccent}">往期推荐</p>`;
        })();
        const cardChrome = (inner: string, extra = ''): string => {
            if (neo) {
                return `<section style="margin:0 8px 12px 0;padding:0;background-color:${palette.paper};border:3px solid ${neoInk};${neoShadow(4)};box-sizing:border-box;max-width:100%;overflow:hidden;${extra}">${inner}</section>`;
            }
            if (tech) {
                return `<section style="margin:0 0 12px;padding:0;background-color:${techDark};border:1px solid ${accent};${techSoft};box-sizing:border-box;max-width:100%;overflow:hidden;${extra}">${inner}</section>`;
            }
            if (pixel) {
                return `<section style="margin:0 0 12px;padding:0;background-color:${palette.surface};border:1px solid ${palette.line};box-sizing:border-box;max-width:100%;overflow:hidden;${extra}">${inner}</section>`;
            }
            if (fest) {
                return `<section style="margin:0 0 12px;padding:0;background-color:${palette.paper};border:2px solid ${recAccent};box-shadow:0 0 0 3px rgba(0,0,0,.04);box-sizing:border-box;max-width:100%;overflow:hidden;${extra}">${inner}</section>`;
            }
            if (magazine) {
                return `<section style="margin:0 0 16px;padding:0;background-color:transparent;border:0;box-sizing:border-box;max-width:100%;overflow:hidden;${extra}">${inner}</section>`;
            }
            if (opinion) {
                return `<section style="margin:0 0 12px;padding:10px 12px;background-color:${palette.surface};border-left:4px solid ${recAccent};border-top:1px solid ${palette.line};border-right:1px solid ${palette.line};border-bottom:1px solid ${palette.line};box-sizing:border-box;max-width:100%;overflow:hidden;${extra}">${inner}</section>`;
            }
            // knowledge / edu / business / corp / default
            return `<section style="margin:0 0 12px;padding:0;background-color:${palette.surface};border:1px solid ${palette.line};border-radius:10px;box-sizing:border-box;max-width:100%;overflow:hidden;${extra}">${inner}</section>`;
        };
        const titleColor = tech || pixel ? (tech ? techHeroInk : palette.ink) : neo ? neoInk : palette.ink;
        const mutedColor = tech || pixel ? (tech ? '#a9c5be' : palette.muted) : palette.muted;
        const coverImg = (src: string, title: string, radius = 0) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(title)}" referrerpolicy="no-referrer" style="display:block;width:100%;max-width:100%;border:0;margin:0;padding:0;box-sizing:border-box;${radius ? `border-radius:${radius}px;` : ''}">`;
        const titleLink = (item: RecItem, size: number, lh: number, weight = 800) => {
            const href = item.href && /^https?:\/\//i.test(item.href) ? escapeHtml(item.href) : '#';
            return `<a href="${href}" style="display:block;color:${titleColor};${wechatTextStyle(size)};font-weight:${weight};text-decoration:none;max-width:100%;word-break:break-word;overflow-wrap:anywhere">${inline(item.title, size, lh)}</a>`;
        };
        const cards = items
            .map((item) => {
            const coverSrc = item.cover ? resolveCover(item.cover) : '';
            const hrefOk = item.href && /^https?:\/\//i.test(item.href);
            const wrapLink = (html: string) => hrefOk ? `<a href="${escapeHtml(item.href)}" style="display:block;text-decoration:none;color:inherit">${html}</a>` : html;
            // Opinion: bold title + small cover
            if (opinion) {
                const thumb = coverSrc
                    ? `<td style="width:72px;padding:0 0 0 10px;border:0;vertical-align:middle"><img src="${escapeHtml(coverSrc)}" alt="" style="display:block;width:72px;max-width:100%;border:0;box-sizing:border-box"></td>`
                    : '';
                const inner = `<table style="width:100%;border-collapse:collapse;border:0;margin:0;padding:0"><tr><td style="padding:0;border:0;vertical-align:middle">${titleLink(item, 17, 28, 900)}</td>${thumb}</tr></table>`;
                return cardChrome(inner);
            }
            // Editorial / research: cover + one caption; no-cover → title once (no dark block + caption)
            if (magazine) {
                if (coverSrc) {
                    const photo = wrapLink(coverImg(coverSrc, item.title));
                    const caption = `<p style="margin:8px 0 0;padding:0;${wechatTextStyle(13)};color:${mutedColor};font-weight:600;letter-spacing:.02em">${titleLink(item, 15, 24, 700)}</p>`;
                    return cardChrome(`${photo}${caption}`);
                }
                const textCard = `<section style="padding:14px 2px 12px;border-top:1px solid ${palette.line};box-sizing:border-box;max-width:100%"><p style="margin:0;padding:0;${wechatTextStyle(16)};font-weight:700;letter-spacing:.04em;color:${titleColor}">${titleLink(item, 16, 26, 700)}</p></section>`;
                return cardChrome(textCard);
            }
            // Thumb row for knowledge family when 3+ items; top cover when 1–2
            if (thumbFamily && !few && coverSrc) {
                const inner = `<table style="width:100%;border-collapse:collapse;border:0;margin:0;padding:0"><tr><td style="width:110px;padding:10px;border:0;vertical-align:middle"><img src="${escapeHtml(coverSrc)}" alt="" style="display:block;width:110px;max-width:100%;border:0;border-radius:6px;box-sizing:border-box"></td><td style="padding:10px 12px 10px 0;border:0;vertical-align:middle">${titleLink(item, 15, 24, 700)}</td></tr></table>`;
                return cardChrome(inner);
            }
            // Default / neo / tech / pixel / fest / few thumbs: top cover + title bar
            const photo = coverSrc
                ? wrapLink(coverImg(coverSrc, item.title))
                : wrapLink(`<section style="padding:22px 14px;background-color:${tech || pixel ? '#0a1018' : '#2a2a2a'};color:#ffffff;${wechatTextStyle(15)};font-weight:700;box-sizing:border-box">${inline(item.title, 15, 24)}</section>`);
            const barBg = tech || pixel ? 'transparent' : neo ? palette.paper : '#ffffff';
            const bar = `<section style="padding:10px 12px;background-color:${barBg};box-sizing:border-box">${titleLink(item, neo || fest ? 16 : 15, neo || fest ? 26 : 24, neo ? 900 : 750)}</section>`;
            // If no cover, title already in placeholder — skip duplicate bar when title-only dark block
            const body = coverSrc ? `${photo}${bar}` : photo;
            return cardChrome(body);
        })
            .join('');
        const shellBorder = neo
            ? ''
            : tech
                ? `border-top:2px solid ${accent};`
                : pixel
                    ? `border-top:2px solid ${accent};`
                    : fest
                        ? `border-top:3px solid ${recAccent};border-bottom:3px solid ${recAccent};`
                        : magazine
                            ? ''
                            : `border-top:2px solid ${recAccent};border-bottom:2px solid ${recAccent};`;
        const shellBg = neo ? palette.paper : tech || pixel || magazine ? 'transparent' : '#ffffff';
        output.push(`<section style="margin:18px 0;padding:12px 0;${shellBorder}background-color:${shellBg};box-sizing:border-box;max-width:100%">${labelHtml}${cards || `<p style="margin:0;${wechatTextStyle(13)};color:${mutedColor}">还没有条目。每行：标题 | 封面 | 链接</p>`}</section>`);
        return output.join('');
    }
    if (kind === 'divider') {
        const [typeRaw = 'hairline', labelRaw = ''] = body.join('').trim().split('|');
        const type = typeRaw === 'chapter-transition' ? 'chapter' : typeRaw;
        const customLabel = escapeHtml(labelRaw.trim().slice(0, 24));
        const divider = type === 'chapter'
            ? `<span style="display:inline-block;padding:4px 10px;border-top:1px solid ${accent};border-bottom:1px solid ${accent};color:${accent};${wechatTextStyle(12)};font-weight:800">${customLabel || '02'}</span>`
            : type === 'diamond'
                ? `<span style="${wechatTextStyle(16)}">— ◆ —</span>`
                : type === 'editorial'
                    ? `<span style="padding:4px 9px;border-top:1px solid #222222;border-bottom:1px solid #222222;${wechatTextStyle(12)}">${customLabel || 'EDITORIAL'}</span>`
                    : type === 'neo'
                        ? `<span style="display:inline-block;padding:4px 8px;border:3px solid ${neoInk};background-color:${accent};color:${neoInk};${wechatTextStyle(12)};font-weight:900;${neoShadow(3)}">＋ ＋ ＋</span>`
                        : type === 'pixel'
                            ? `<span style="padding:5px 8px;border-left:3px solid ${accent};background-color:${palette.surface};color:${accent};${wechatTextStyle(12)};font-weight:800">// ${customLabel || 'NEXT'} //</span>`
                            : business
                                ? `<span style="display:inline-block;width:72px;border-top:1px solid ${accent};${wechatTextStyle(16)};color:transparent">—</span>`
                                : corp
                                    ? `<span style="display:inline-block;width:48px;border-top:2px solid ${accent};${wechatTextStyle(16)};color:transparent">—</span>`
                                    : research
                                        ? `<span style="display:inline-block;width:56px;border-top:1px solid ${accent};${wechatTextStyle(16)};color:transparent">—</span>`
                                        : `<span style="display:inline-block;width:64px;border-top:2px solid ${accent};${wechatTextStyle(16)};color:transparent">—</span>`;
        output.push(`<p style="margin:28px 0;text-align:center;color:${accent};${wechatTextStyle(16)}">${divider}</p>`);
        return output.join('');
    }
    return renderCallout(theme, kind, body, inline);
}
