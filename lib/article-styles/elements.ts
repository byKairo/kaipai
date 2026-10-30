import { v4Heading, v4Quote, v4Paragraph, v4Table, v4Image } from './v4-elements';
import type { ArticleStyle, ImageTreatment } from '../styles';
import { wechatTextStyle } from '../wechat-typography';
export type Theme = {
    style: ArticleStyle;
    accent: string;
    ink: string;
    muted: string;
    paper: string;
    line: string;
    surface: string;
    quote: string;
    font: string;
    bodySize: number;
    lineHeight: number;
    paragraphGap: number;
    imageRadius: number;
};
export type InlineRenderer = (value: string, size?: number, lineHeight?: number) => string;
/** Every text-bearing element owns typography, color and a local font fallback. No external CSS. */
function node(t: Theme, tag: string, html: string, size: number, css = '') {
    return `<${tag} style="${wechatTextStyle(size)};color:${t.ink};${t.font}overflow-wrap:anywhere;word-break:break-word;${css}">${html}</${tag}>`;
}
function section(t: Theme, html: string, css: string) { return node(t, 'section', html, t.bodySize, `box-sizing:border-box;max-width:100%;${css}`); }
function label(t: Theme, html: string, css = '') { return node(t, 'p', html, 12, `margin:0 0 12px;color:${t.muted};${css}`); }
export function headingSize(t: Theme, level: 1 | 2 | 3) { if(t.style.preset) return level===1?parseFloat(t.style.preset.h1):level===2?parseFloat(t.style.preset.h2):Math.max(16,t.bodySize); return level === 1 ? (t.style.design === 'cotton' ? 27 : t.style.design === 'brand' ? 38 : t.style.design === 'portrait' ? 30 : t.style.design === 'weekend' ? 40 : t.style.design === 'brief' ? 26 : ['idea', 'neo'].includes(t.style.design) ? 36 : t.style.font === 'serif' ? 28 : 30) : level === 2 ? (t.style.design === 'cotton' ? 22 : t.style.design === 'portrait' ? 20 : t.style.design === 'brief' ? 19 : 21) : t.style.design === 'brief' ? 16 : 18; }
export function renderHeading(t: Theme, level: 1 | 2 | 3, html: string, number = '', eyebrow = '') {
    if(t.style.preset) return v4Heading(t,level,html,number,eyebrow);
    const d = t.style.design, accent = t.accent, secondary = t.style.colors.secondary;
    const size = headingSize(t, level);
    let css = `margin:${level === 1 ? '10px 0 28px' : '30px 0 16px'};font-weight:${level === 1 ? 750 : 650};text-align:left;box-sizing:border-box;max-width:100%;`;
    let prefix = number ? node(t, 'span', `${number}　`, 12, `color:${accent};font-weight:600;`) : '';
    if (level === 3 && d === 'cotton') return node(t, 'h3', html, 18, css + `margin:32px 0 16px;padding:0;border:0;font-family:'Songti SC',SimSun,serif;color:${t.ink};font-weight:700;`);
    if (level === 3 && ['portrait', 'column', 'brand'].includes(d))
        return node(t, 'h3', html, size, css + `border:0;padding:${d === 'brand' ? '0 16px' : '0'};font-weight:700;`);
    if (level === 3)
        return node(t, 'h3', html, size, css + `border-left:2px solid ${accent};padding-left:10px;`);
    switch (d) {
        case 'cotton': {
            const headlineInk = t.ink === t.style.colors.text ? '#2b302c' : t.ink;
            css += `font-family:'Songti SC',SimSun,serif;color:${headlineInk};font-weight:700;letter-spacing:0.3px;`;
            css += level === 1 ? 'margin:0 0 36px;padding:0;border:0;' : 'margin:60px 0 28px;padding:0;border:0;';
            prefix = level === 2 && number ? node(t, 'span', number, 12, `display:block;margin:0 0 10px;color:${accent};font-family:'PingFang SC','Microsoft YaHei',sans-serif;font-weight:500;letter-spacing:3px;`) : '';
            if (level === 2) html += node(t, 'span', '', 12, `display:block;width:36px;margin:16px 0 0;border-bottom:2px solid ${accent};`);
            break;
        }
        case 'idea':
            css += level === 1 ? `color:${accent};font-weight:850;` : `display:inline-block;max-width:94%;padding:8px 12px;margin:30px 6px 20px;background-color:${accent};color:#ffffff;transform:rotate(-2deg);`;
            prefix = '';
            break;
        case 'log':
            css += level === 1 ? `padding:0 0 20px;border-bottom:2px solid ${t.ink};font-weight:800;` : 'margin:0 0 20px;padding:0;';
            prefix = level === 2 && number ? node(t, 'span', number, 24, `display:block;width:48px;text-align:center;border:2px solid ${t.ink};border-radius:24px;margin-bottom:12px;`) : '';
            break;
        case 'brief':
            css += level === 1 ? `margin:0 0 24px;padding-bottom:16px;border-bottom:2px solid ${t.ink};font-weight:750;` : `margin:30px 0 14px;padding:8px 0;border-bottom:1px solid ${t.line};font-weight:750;`;
            prefix = level === 2 && number ? node(t, 'span', number, 13, `display:inline-block;padding:0 10px 0 0;margin-right:10px;border-right:1px solid ${t.line};color:${t.muted};`) : '';
            break;
        case 'brand':
            css += level === 1 ? 'padding:0 16px;margin:0 0 36px;font-weight:850;letter-spacing:-1px;text-wrap:balance;' : `padding:0 16px;margin:46px 0 20px;font-weight:750;`;
            prefix = level === 2 && number ? node(t, 'span', number, 42, `display:block;color:${t.ink};font-weight:300;border-top:1px solid ${t.ink};padding-top:8px;margin-bottom:4px;`) : '';
            break;
        case 'research':
            css += level === 1 ? `margin:0 0 28px;padding:18px 0;border-top:6px solid ${t.ink};border-bottom:1px solid ${t.ink};font-weight:800;` : `margin:34px 0 16px;padding-bottom:10px;border-bottom:1px solid ${t.ink};`;
            prefix = level === 2 && number ? node(t, 'span', number + ' / ', 16, `font-family:Menlo,Consolas,monospace;color:${t.ink};`) : '';
            break;
        case 'portrait':
            css += level === 2 ? 'text-align:center;margin:54px 0 26px;font-weight:600;' : `text-align:left;font-weight:600;padding:0 0 24px;margin:0 0 36px;border-bottom:1px solid ${t.line};`;
            prefix = level === 2 && number ? node(t, 'span', number, 12, `display:block;margin:0 0 8px;letter-spacing:3px;color:${t.muted};`) : '';
            break;
        case 'column':
            css += level === 1 ? `margin:0 6px 26px;font-weight:850;` : `margin:0 0 20px;padding:0 0 16px;border-bottom:2px solid ${t.ink};font-weight:750;`;
            prefix = level === 2 && number ? node(t, 'span', number, 13, `display:inline-block;margin-right:10px;padding:3px 9px;background-color:${t.ink};color:${t.paper};font-weight:750;vertical-align:middle;`) : '';
            break;
        case 'weekend':
            css += level === 1 ? 'padding:0 20px;margin:0 0 40px;font-weight:800;letter-spacing:-1px;text-wrap:balance;' : 'padding:0 20px;margin:48px 0 24px;font-weight:600;';
            prefix = '';
            break;
        case 'culture':
            css += level === 1 ? 'padding:16px 0 36px;text-align:center;font-weight:500;letter-spacing:3px;' : `margin:52px 0 32px;text-align:center;font-weight:500;`;
            prefix = level === 2 ? node(t, 'span', number || '·', 12, `display:block;margin:0 auto 14px;width:44px;border-top:1px solid ${t.ink};padding-top:12px;color:${t.muted};`) : '';
            break;
        case 'neo':
            css += `display:inline-block;border:3px solid #202020;background-color:${level === 1 ? t.style.colors.mark : secondary};color:#202020;padding:${level === 1 ? 14 : 8}px 12px;margin-right:9px;box-shadow:${level === 1 ? 5 : 3}px ${level === 1 ? 5 : 3}px 0 #202020;font-weight:850;${level === 2 ? 'transform:rotate(-1deg);' : 'text-wrap:balance;'}`;
            prefix = number ? node(t, 'span', `${number}　`, 12, 'color:#202020;font-weight:600;') : '';
            break;
        case 'pixel':
            css += level === 1 ? `margin:8px 0 40px;font-weight:500;color:${t.ink};` : `margin:44px 0 26px;font-weight:500;color:${t.ink};`;
            prefix = level === 2 ? node(t, 'span', number || '· · ·', 12, `display:block;margin-bottom:14px;letter-spacing:3px;color:${t.muted};`) : '';
            break;
    }
    const heading = node(t, `h${level}`, prefix + html, size, css);
    // Eyebrow comes from explicit user input only; never invent article metadata.
    return level === 1 && eyebrow ? label(t, eyebrow, `letter-spacing:2px;color:${accent};`) + heading : heading;
}
export function renderQuote(t: Theme, value: string, inline: InlineRenderer, index = 0) {
    if(t.style.preset) return v4Quote(t,value,inline);
    const d = t.style.design;
    let size = 20, css = 'margin:28px 0;padding:18px 0;box-sizing:border-box;max-width:100%;', prefix = '';
    switch (d) {
        case 'cotton':
            size = 17;
            css += `margin:32px 0;padding:2px 0 2px 16px;border-left:2px solid ${t.line};color:${t.muted};font-style:normal;`;
            break;
        case 'idea':
            css += `margin:30px 8px;padding:17px;background-color:${t.quote};color:${t.ink};border:1px solid ${t.line};transform:rotate(1.5deg);`;
            break;
        case 'log':
            size = 16;
            css += `padding:12px;border:1px dashed ${t.ink};background-color:${t.surface};`;
            break;
        case 'brief':
            size = 17;
            css += `margin:18px 0;padding:12px 14px;background-color:${t.quote};border-left:2px solid ${t.ink};font-weight:600;`;
            break;
        case 'brand':
            size = 24;
            css += `margin:36px 16px;padding:24px 0;border-top:1px solid ${t.ink};border-bottom:1px solid ${t.ink};font-weight:650;`;
            break;
        case 'research':
            size = 15;
            css += `padding:14px 18px;border-top:1px dashed ${t.line};border-bottom:1px dashed ${t.line};color:${t.muted};`;
            break;
        case 'portrait':
            size = 20;
            css += `margin:40px 6px;padding:0 8px;text-align:left;font-weight:500;color:${t.ink};`;
            prefix = node(t, 'span', '“', 30, `display:block;font-family:'Songti SC',SimSun,serif;color:${t.muted};`);
            break;
        case 'column':
            size = 17;
            css += `margin:20px 0;padding:14px 16px;border-left:4px solid ${t.ink};background-color:${t.quote};font-weight:650;`;
            break;
        case 'weekend':
            size = 23;
            css += `margin:40px 20px;padding:0;text-align:left;font-weight:500;`;
            break;
        case 'culture':
            size = 19;
            css += `margin:44px 12px;padding:0;text-align:center;font-weight:400;`;
            break;
        case 'neo':
            size = 18;
            css += `width:88%;margin:24px ${index % 2 ? '0 24px auto' : 'auto 24px 0'};border:2px solid #202020;border-radius:${index % 2 ? '18px 18px 3px 18px' : '18px 18px 18px 3px'};background-color:${t.quote};color:#202020;padding:14px;box-shadow:3px 3px 0 #202020;font-weight:700;`;
            break;
        case 'pixel':
            size = 20;
            css += `margin:36px 12px;padding:18px 0;border-top:1px solid ${t.line};color:${t.muted};font-weight:400;`;
            break;
    }
    return node(t, 'blockquote', prefix + inline(value, size), size, css);
}
export function renderImage(t: Theme, source: string, caption: string, treatment: ImageTreatment, escape: (v: string) => string, index = 1) {
    if(t.style.preset) return v4Image(t,source,caption,escape);
    const polaroid = treatment === 'polaroid', film = treatment === 'film', magazine = treatment === 'magazine';
    const whiteInk = '#686d65';
    const image = `<img src="${escape(source)}" alt="${escape(caption)}" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:${polaroid || film ? 0 : t.imageRadius}px;">`;
    if (t.style.design === 'brand') {
        const cap = caption ? node(t, 'p', escape(caption), 12, `margin:0;padding:12px 16px;border-bottom:1px solid ${t.line};color:${t.muted};`) : '';
        return section(t, image + cap, 'margin:32px 0 40px;padding:0;');
    }
    if (t.style.design === 'portrait') {
        const cap = caption ? node(t, 'p', escape(caption), 12, `margin:10px 0 0;text-align:center;color:${t.muted};`) : '';
        return section(t, image + cap, 'margin:32px 0;padding:0;');
    }
    const d = t.style.design;
    if (['weekend', 'research', 'log', 'neo', 'pixel', 'culture', 'cotton'].includes(d)) {
        const frame = d === 'weekend' ? 'margin:40px 0 48px;padding:0;'
            : d === 'research' ? `margin:24px 0;padding:12px 0;border-top:1px solid ${t.line};border-bottom:1px solid ${t.line};`
            : d === 'log' ? `margin:20px 0;padding:6px;border:1px solid ${t.line};`
            : d === 'neo' ? 'margin:24px 0;padding:0;border:2px solid #202020;'
            : d === 'culture' ? 'margin:42px 16px;padding:0;'
            : 'margin:32px 0;padding:0;';
        const labelPrefix = d === 'weekend' ? `${String(index).padStart(2, '0')} / ` : d === 'research' ? `图 ${index}　` : '';
        const cap = caption ? node(t, 'p', labelPrefix + escape(caption), 12, `margin:10px 0 0;padding:${d === 'weekend' || d === 'neo' ? '0 12px 10px' : '0'};text-align:${d === 'culture' || d === 'weekend' ? 'center' : 'left'};color:${t.muted};`) : '';
        return section(t, image + cap, frame);
    }
    let css = 'margin:26px 0 30px;padding:0;';
    if (polaroid)
        css += 'width:94%;margin-left:auto;margin-right:auto;border:1px solid #d7d9cf;background-color:#ffffff;padding:11px 11px 18px;box-shadow:0 3px 10px rgba(0,0,0,.08);';
    if (film)
        css += 'background-color:#272a29;padding:12px;';
    const top = film ? label(t, 'FRAME / CONTACT SHEET', 'color:#e7eae4;letter-spacing:1px;') : '';
    const cap = caption ? node(t, 'p', escape(caption), 12, `margin:12px 0 0;text-align:${polaroid ? 'center' : 'left'};color:${polaroid ? whiteInk : film ? '#e7eae4' : t.muted};${magazine ? `border-left:2px solid ${t.accent};padding-left:12px;` : ''}`) : '';
    return section(t, top + image + cap, css);
}
export function renderTable(t: Theme, rows: string[][], inline: InlineRenderer) {
    if(t.style.preset) return v4Table(t,rows,inline);
    if (t.style.design === 'brand') {
        const body = rows.map((row, i) => `<tr>${row.map(cell => node(t, i ? 'td' : 'th', inline(cell, 13), 13, `padding:13px 8px;text-align:left;vertical-align:top;border-bottom:1px solid ${t.line};font-weight:${i ? 400 : 750};`)).join('')}</tr>`).join('');
        return section(t, node(t, 'table', `<tbody>${body}</tbody>`, 13, `width:100%;table-layout:fixed;border-collapse:collapse;border-top:2px solid ${t.ink};`), 'margin:24px 0 36px;padding:0 16px;');
    }
    const d = t.style.design, neo = d === 'neo', pixel = d === 'pixel', research = d === 'research', portrait = d === 'portrait';
    const simple = research || portrait || pixel || d === 'cotton' || d === 'culture';
    const border = neo ? '#202020' : t.line;
    const thBg = pixel ? t.paper : neo ? t.style.colors.secondary : d === 'brief' ? '#264c70' : simple ? 'transparent' : t.surface;
    const thInk = pixel ? t.ink : d === 'brief' ? '#ffffff' : neo ? '#202020' : t.ink;
    const body = rows.map((row, i) => `<tr>${row.map(cell => node(t, i ? 'td' : 'th', inline(cell, 14), 14, `padding:11px 9px;vertical-align:top;text-align:left;font-weight:${i ? 400 : 650};color:${i ? t.ink : thInk};background-color:${i ? simple || pixel ? 'transparent' : i % 2 ? t.surface : t.paper : thBg};border-bottom:${neo ? 3 : 1}px solid ${border};word-break:break-word;overflow-wrap:anywhere;`)).join('')}</tr>`).join('');
    return node(t, 'table', `<tbody>${body}</tbody>`, 14, `width:100%;max-width:100%;table-layout:fixed;border-collapse:collapse;margin:22px 0;box-sizing:border-box;${simple ? `border-top:2px solid ${border};border-bottom:2px solid ${border};` : `border:${neo ? 3 : 1}px solid ${border};`}${neo ? 'box-shadow:4px 4px 0 #202020;' : ''}`);
}
export function renderParagraph(t: Theme, value: string, inline: InlineRenderer, dropCap = false) {
    if(t.style.preset) return v4Paragraph(t,value,inline);
    // Keep opening numbers together; never split Markdown syntax, links or emoji.
    const opening = dropCap ? value.match(/^(?:[\u4e00-\u9fff]|\d+)/)?.[0] : undefined;
    const eligible = Boolean(opening && value.length > opening.length);
    const dropHeight = t.lineHeight * 2;
    const dropSize = Math.min(t.bodySize * 2, Math.floor(dropHeight / 1.8));
    const html = eligible ? node(t, 'span', opening!, dropSize, `float:left;font-weight:700;margin:0 9px 0 0;line-height:${dropHeight}px;height:${dropHeight}px;`) + inline(value.slice(opening!.length), t.bodySize) : inline(value, t.bodySize);
    const d = t.style.design;
    const shortLine = d === 'culture' && Array.from(value.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_~=`]/g, '')).length <= 42;
    const spacing = d === 'cotton' ? 'letter-spacing:0.3px;' : d === 'brand' ? 'padding:0 16px;' : d === 'weekend' ? 'padding:0 20px;'
        : d === 'idea' ? `padding:0 0 16px;border-bottom:1px dashed ${t.line};`
        : '';
    const paragraph = node(t, 'p', html, t.bodySize, `margin:0 0 ${t.paragraphGap}px;${spacing}text-align:${shortLine ? 'center' : 'left'};line-height:${t.lineHeight}px;word-break:break-word;overflow-wrap:anywhere;`);
    return eligible ? section(t, paragraph, 'overflow:hidden;') : paragraph;
}
export function renderCallout(t: Theme, kind: string, body: string[], inline: InlineRenderer, renderImageLine?: (line: string) => string | null) {
    const warning = kind === 'warn', lead = kind === 'lead', d = t.style.design;
    let bg = warning ? '#fff4e8' : t.surface, ink = warning ? '#684326' : t.ink;
    let css = `margin:24px 0;padding:17px;border-left:3px solid ${t.accent};`;
    const name = kind === 'author' ? '作者' : warning ? '注意' : lead ? d === 'research' ? '摘 要' : d === 'brief' ? '核心结论' : '导读' : '重点';
    if (d === 'neo') {
        bg = warning ? '#fff0c9' : t.surface;
        ink = '#202020';
        css += 'border:3px solid #202020;box-shadow:4px 4px 0 #202020;margin-right:8px;';
    }
    if (d === 'weekend')
        css = 'margin:24px 20px 36px;padding:16px;border:0;';
    if (d === 'log') css = `margin:20px 0;padding:14px;border:1px dashed ${t.ink};`;
    if (d === 'brief') css = `margin:16px 0;padding:14px;border:1px solid ${t.line};border-top:3px solid ${t.ink};`;
    if (d === 'research' && lead) css = `margin:22px 0 30px;padding:16px;border:0;border-left:1px solid ${t.ink};`;
    if (d === 'culture') css = 'margin:32px 0;padding:20px 12px;border:0;text-align:center;';
    if (d === 'pixel') css = `margin:32px 0;padding:20px 16px;border:0;border-top:1px solid ${t.line};`;
    if (d === 'cotton') css = `margin:28px 0;padding:16px 18px;border:0;border-left:2px solid ${t.line};`;
    if (d === 'cotton' && lead) css = `margin:0 0 28px;padding:0 0 18px;border:0;border-bottom:1px solid ${t.line};`;
    if (d === 'brand' && lead)
        css = 'margin:0 16px 32px;padding:20px;border:0;';
    if (d === 'portrait' && lead) {
        bg = t.paper;
        css = `margin:0 0 32px;padding:0 0 24px;border:0;border-bottom:1px solid ${t.line};`;
    }
    const local = { ...t, ink };
    const content = body.filter(line => line.trim()).map(line => renderImageLine?.(line) ?? node(local, 'p', inline(line, t.bodySize), t.bodySize, 'margin:0 0 8px;')).join('');
    return section(local, label(local, name, `color:${ink};font-weight:650;`) + content, css + `background-color:${bg};color:${ink};`);
}
export function renderComparison(t: Theme, title: string, rows: {
    tag: string;
    name: string;
    note: string;
}[], conclusion: string, inline: InlineRenderer) {
    if (t.style.design !== 'brand')
        return renderTable(t, [[title, '说明'], ...rows.map(row => [`${row.tag} ${row.name}`, row.note]), ...(conclusion ? [['结论', conclusion]] : [])], inline);
    // True table cells hold any number of equal-width items without inline-block wrapping or fixed pixel widths.
    const cells = rows.map(row => node(t, 'td', node(t, 'p', inline(`${row.tag} ${row.name}`.trim(), 20), 20, `margin:0;color:${t.accent};font-weight:700;text-align:center;`) + node(t, 'p', inline(row.note, 12), 12, `margin:8px 0 0;color:${t.muted};text-align:center;`), 14, `padding:13px 5px;border:1px solid ${t.line};vertical-align:top;`)).join('');
    return label(t, inline(title, 12)) + node(t, 'table', `<tbody><tr>${cells}</tr></tbody>`, 14, 'width:100%;table-layout:fixed;border-collapse:separate;border-spacing:5px 0;margin:22px 0;') + (conclusion ? renderParagraph(t, conclusion, inline) : '');
}
export function renderArticleShell(t: Theme, article: string, padX: number, padY: number, texture = '') {
    // Opaque raster background and its text share a container, matching the dark-mode nesting contract.
    const material = texture ? `background-image:url('${texture}');background-size:320px 320px;background-repeat:repeat;` : '';
    return section(t, article, `width:100%;margin:0 auto;padding:${padY}px ${padX}px;background-color:${t.paper};${material}text-align:left;word-break:break-word;overflow-wrap:anywhere;-webkit-text-size-adjust:100%;`);
}

export function renderFootnotes(t: Theme, notes: [string, string][], inline: InlineRenderer) {
    if (!notes.length) return '';
    const local = { ...t, ink: t.muted };
    return section(local, notes.map(([key, value]) => node(local, 'p', inline(`${key}　${value}`, 12), 12, 'margin:0 0 8px;')).join(''), `margin:24px 0 0;padding-top:12px;border-top:1px solid ${t.line};`);
}
