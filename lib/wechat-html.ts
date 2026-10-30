import { codeSkin, emphasisStyle } from './article-styles/visual-rules';
/** WeChat OA clipboard HTML — also drives the live preview so both stay identical. */
import { headingSize, renderFootnotes, renderHeading, renderQuote, renderImage, renderTable, renderParagraph, renderArticleShell, type Theme } from './article-styles/elements';
import { renderHeadingTemplate } from './article-styles/heading-template';
import { renderComponent } from './article-styles/components';
import { findStyle, getStyleComponentDefaults } from './styles';
import { wechatMinLineHeight, wechatTextStyle, wechatBox } from './wechat-typography';
import { enforceWechatCompliance } from './wechat-compliance';
import { displayHeadingWithoutNumber, normalizeMarkdownTables } from './ai-layout';
import { escapeHtml } from './wechat-text';
import { safeArticleLink } from './article-link';
export { escapeHtml, htmlToPlainText } from './wechat-text';
import { SAMPLE_IMAGE } from './article-styles/sample-image';
import { isDarkPaper, inkOn, readableAccent, accentTextOnPaper, contrastRatio, paletteForArticle, type Palette } from './article-styles/palette';
import { resolveArticleHighlight } from './article-styles/highlight';
export type WechatReadingOptions = {
    fontSize?: number;
    lineHeight?: number;
    paragraphGap?: number;
    padY?: number;
    imageRadius?: number;
    fontFamily?: string;
    /** Optional user override for article text; empty keeps the style ink. */
    fontColor?: string;
    headingStyle?: string;
    headingIcon?: string;
    headingLabel?: string;
    headingPrefix?: string;
    headingSeparator?: string;
    headingNumberFormat?: '01' | '1' | '一' | 'none';
    variant?: string;
    /** Resolved article paper (from paperMode follow/style/custom). Ink is recomputed from this. */
    paper?: string;
    /** Optional WeChat-hosted opaque paper tile; empty keeps the column paper plain. */
    paperTextureUrl?: string;
};
const HEADING_STYLE_IDS = new Set([
    'bar', 'frame', 'twin', 'markerHalf', 'markerUnder', 'markerLine', 'numberFrame', 'eyebrow', 'iconTag', 'avatarLeft', 'avatarTop', 'poster', 'brand',
]);
function normalizeHeadingStyleId(value?: string) {
    if (!value)
        return 'bar';
    if (value === 'eyebrow')
        return 'twin';
    return HEADING_STYLE_IDS.has(value) ? value : 'bar';
}
function chineseChapterNumber(index: number) {
    const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    if (index <= 10)
        return index === 10 ? '十' : digits[index] || String(index);
    if (index < 20)
        return `十${digits[index % 10]}`.replace(/零$/, '');
    if (index < 100)
        return `${digits[Math.floor(index / 10)]}十${index % 10 ? digits[index % 10] : ''}`;
    return String(index);
}
/** Allow only WeChat-safe / project stacks; exotic web fonts are dropped.
 *  Normalize to single-quoted names so style="..." attributes stay valid. */
function resolveSafeFontFamily(raw?: string) {
    if (!raw || typeof raw !== 'string')
        return '';
    const v = raw.trim();
    if (!v || /[;<>]/.test(v))
        return '';
    const ok = /PingFang|Microsoft YaHei|Noto Sans|Noto Serif|Songti|SimSun|Kaiti|KaiTi|FangSong|STFangsong|LXGW|Zhuque|system-ui|ui-monospace|monospace|Menlo|Monaco|Consolas/i.test(v);
    if (!ok)
        return '';
    // style="..." cannot nest double quotes — rewrite "Name" → 'Name'
    return v.replace(/"/g, "'");
}
export function markdownToWechat(markdown: string, accent: string, marker = '#fff07a', styleId = 'knowledge', sidePadding = 24, _eyebrow = '', reading: WechatReadingOptions = {}) {
    const styleReading = findStyle(styleId).reading;
    const intensity = reading.variant === '克制' ? -1 : reading.variant === '视觉化' ? 1 : 0;
    const bodyFontSize = (Number.isFinite(reading.fontSize) ? Number(reading.fontSize) : styleReading?.fontSize ?? 16) + intensity * 2;
    const bodyLineHeightRatio = Number.isFinite(reading.lineHeight) ? Number(reading.lineHeight) : styleReading?.lineHeight ?? 1.82;
    const bodyLineHeightPx = Math.max(Math.round(bodyFontSize * bodyLineHeightRatio), wechatMinLineHeight(bodyFontSize));
    const bodyParagraphGap = (Number.isFinite(reading.paragraphGap) ? Number(reading.paragraphGap) : styleReading?.paragraphGap ?? 16) + intensity * 7;
    const bodyImageRadius = Number.isFinite(reading.imageRadius) ? Number(reading.imageRadius) : 8;
    const headingStyleId = normalizeHeadingStyleId(reading.headingStyle);
    const headingIconChar = (typeof reading.headingIcon === 'string' && reading.headingIcon.trim() ? reading.headingIcon.trim() : '◆').slice(0, 4);
    const headingLabel = escapeHtml((reading.headingLabel ?? '').trim().slice(0, 12));
    const headingPrefix = escapeHtml((reading.headingPrefix ?? '').trim().slice(0, 4));
    const headingSeparator = escapeHtml((reading.headingSeparator ?? '').trim().slice(0, 4));
    const headingNumberFormat = ['01', '1', '一', 'none'].includes(reading.headingNumberFormat || '') ? reading.headingNumberFormat : getStyleComponentDefaults(styleId).headingNumberFormat;
    const safeFontFamily = resolveSafeFontFamily(reading.fontFamily || findStyle(styleId).typography.fontFamily);
    const fontFamilyDecl = safeFontFamily ? `font-family:${safeFontFamily};` : '';
    const pixel = styleId === 'pixelpost';
    const neo = styleId === 'boldneo';
    const tech = styleId === 'tech';
    const editorial = styleId === 'editorial';
    const knowledge = styleId === 'knowledge';
    const isOpinion = styleId === 'opinion';
    const research = styleId === 'research';
    const edu = styleId === 'edu';
    const business = styleId === 'business';
    const corp = styleId === 'corp';
    const isEvent = styleId === 'event';
    const isFestival = styleId === 'festival';
    const pink = findStyle(styleId).colors.secondary;
    const neoInk = '#151515';
    /** Single hard offset (0 blur) — WeChat-safe; do not stack shadows. */
    const neoShadow = (n = 5) => `box-shadow:${n}px ${n}px 0 ${neoInk}`;
    /** Tech chrome tokens — dark Hero/chapter only; body stays light paper. */
    const techDark = '#17363b';
    const techHeroInk = '#e6f0ec';
    /** Single soft shadow — WeChat-safe; do not stack. */
    const techSoft = 'box-shadow:0 8px 18px rgba(9,19,31,.14)';
    // Paper comes from paperMode (follow/style/custom) when provided; otherwise the style token.
    // Only pixelpost (and any truly dark custom paper) gets light ink — never tech/corp by name.
    const stylePaper = findStyle(styleId).paper;
    const resolvedPaper = typeof reading.paper === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(reading.paper.trim())
        ? reading.paper.trim()
        : stylePaper;
    const darkPaper = isDarkPaper(resolvedPaper);
    const palette: Palette = paletteForArticle(styleId, resolvedPaper);
    if (typeof reading.fontColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(reading.fontColor)) {
        palette.ink = reading.fontColor;
    }
    /** Text on solid accent chips — never hardcode #fff. */
    const chipInk = inkOn(accent);
    /** Accent-as-label on paper — readable or fall back to ink. */
    const accentLabel = accentTextOnPaper(accent, palette.paper, palette.ink);
    const h3Size = Math.min(20, Math.max(16, bodyFontSize + 1));
    const theme: Theme = { style: findStyle(styleId), accent, ink: palette.ink, muted: palette.muted, paper: palette.paper, line: palette.line, surface: palette.surface, quote: palette.quote, font: fontFamilyDecl, bodySize: bodyFontSize, lineHeight: bodyLineHeightPx, paragraphGap: bodyParagraphGap, imageRadius: bodyImageRadius };
    const lines = normalizeMarkdownTables(markdown).split('\n');
    const output: string[] = [];
    let inCode = false;
    let codeLang = 'code';
    let list: 'ul' | 'ol' | null = null;
    let chapterIndex = 0;
    let paragraphSeen = false;
    let quoteIndex = 0;
    let imageIndex = 0;
    // Keep each question and all of its existing blocks together. Do not rewrite or reorder text.
    let questionOpen = false;
    const closeQuestion = () => {
        if (questionOpen) output.push('</section>');
        questionOpen = false;
    };
    const notes = new Map<string, string>();
    const closeList = () => {
        if (list)
            output.push(`</${list}>`);
        list = null;
    };
    const markSkin = resolveArticleHighlight(styleId, marker, palette.paper, palette.ink);
    const linkAccent = theme.style.preset ? (contrastRatio(accent,palette.paper)>=4.5?accent:palette.ink) : readableAccent(accent);
    /** Never emit font-size/line-height:inherit — WeChat's checker treats inherit as abnormal. */
    const inline = (value: string, fontSize = 16, _lineHeight = 30) => {
        const type = wechatTextStyle(fontSize);
        const codeType = wechatTextStyle(13);
        // Inline code: dark charcoal chip + light text on dark paper; soft chip + dark ink on light.
        const codeColor = darkPaper ? '#e8eaed' : '#1a1a1a';
        const codeBg = darkPaper ? '#2a2e36' : '#eceff3';
        const formatText = (text: string) => escapeHtml(text)
            .replace(/\[\^([\w-]+)\]/g, `<sup style="${wechatTextStyle(11)};color:${accentLabel}">$1</sup>`)
            .replace(/\*\*(.*?)\*\*/g, `<strong style="${type};${emphasisStyle(theme)}">$1</strong>`)
            .replace(/\*(.*?)\*/g, `<em style="${type}">$1</em>`)
            .replace(/~~(.*?)~~/g, `<span style="text-decoration:line-through;${type}">$1</span>`)
            .replace(/==(.*?)==/g, `<span style="${markSkin.css}${type}">$1</span>`)
            .replace(/`([^`]+)`/g, `<span style="padding:1px 5px;background-color:${codeBg};color:${codeColor};${codeType};font-family:Menlo,Monaco,Consolas,ui-monospace,monospace">$1</span>`);
        // Parse destinations before adding any HTML formatting. Generated tags
        // must never become part of an href or be parsed as more Markdown.
        let tokenPrefix = '\uE000kaipai-link-';
        while (value.includes(tokenPrefix)) tokenPrefix += '-';
        const links: string[] = [];
        const text = value.replace(/\[(.*?)\]\((.*?)\)/g, (_match, title: string, target: string) => {
            const label = formatText(title);
            const href = safeArticleLink(target);
            const token = `${tokenPrefix}${links.length}\uE001`;
            links.push(href === null ? label : `<a href="${escapeHtml(href)}" style="color:${linkAccent};text-decoration:underline;${type}">${label}</a>`);
            return token;
        });
        let result = formatText(text);
        links.forEach((link, index) => { result = result.split(`${tokenPrefix}${index}\uE001`).join(link); });
        return result;
    };
    // Images are blocks in both the article body and editable component containers.
    const renderImageLine = (line: string): string | null => {
        const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (!image) return null;
        const source = image[2].startsWith('sample://') ? SAMPLE_IMAGE : image[2];
        return renderImage(theme, source, image[1], theme.style.imageTreatment, escapeHtml, ++imageIndex);
    };
    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line.startsWith('```')) {
            closeList();
            if (inCode) {
                output.push('</span></section></section>');
                codeLang = 'code';
            }
            else {
                const langRaw = line.slice(3).trim().split(/\s+/)[0] || '';
                codeLang = /^[a-zA-Z][\w.+#-]*$/.test(langRaw) ? langRaw.toLowerCase() : 'code';
                const skin = codeSkin(theme);
                const dot = (color: string) => `<span style="color:${color};${wechatTextStyle(12)}">●</span>`;
                const language = `<span style="${wechatTextStyle(11)};color:${skin.labelInk};font-weight:600;font-family:Menlo,Consolas,monospace">${escapeHtml(codeLang)}</span>`;
                const chrome = skin.chrome === 'none' ? '' : `<section style="padding:8px 12px;background-color:${skin.header};${wechatTextStyle(12)};border-bottom:1px solid ${palette.line}">${skin.chrome === 'traffic' ? dot('#ff5f57') + '&nbsp;' + dot('#febc2e') + '&nbsp;' + dot('#28c840') + '&nbsp;&nbsp;' : ''}${language}</section>`;
                const codeOuterType = wechatBox({ margin: skin.margin, padding: '0', 'background-color': skin.background, color: skin.ink, 'text-align': 'left', 'box-sizing': 'border-box', 'max-width': '100%', overflow: theme.style.preset ? 'auto' : 'hidden', 'font-size': skin.size });
                const codeText = `${wechatTextStyle(skin.size)};word-break:break-word;overflow-wrap:anywhere;white-space:${theme.style.preset ? 'pre' : 'pre-wrap'};font-family:Menlo,Monaco,Consolas,ui-monospace,monospace;color:${skin.ink}`;
                output.push(`<section style="${codeOuterType};${skin.frame}">${chrome}<section style="margin:0;padding:${skin.padding};background-color:${skin.background};${codeText};text-align:left;box-sizing:border-box;max-width:100%;${theme.style.preset?'overflow-x:auto;':''}"><span style="${codeText}">`);
            }
            inCode = !inCode;
            continue;
        }
        if (inCode) {
            output.push(`${escapeHtml(line)}\n`);
            continue;
        }
        const component = line.match(/^:::(lead|callout|tip|warn|follow|recommendations|recs|author|divider|compare)$/);
        if (component) {
            closeList();
            const body: string[] = [];
            while (++index < lines.length && lines[index] !== ':::')
                body.push(lines[index]);
            const kind = component[1] === 'tip' ? 'callout' : component[1] === 'recs' ? 'recommendations' : component[1];
            if (['author', 'follow', 'recommendations'].includes(kind)) closeQuestion();
            output.push(renderComponent(kind, body, theme, { accent, business, chipInk, corp, darkPaper, editorial, edu, isEvent, isFestival, isOpinion, knowledge, neo, neoInk, neoShadow, palette, pink, pixel, reading, research, styleId, tech, techDark, techHeroInk, techSoft, inline, renderImageLine }));
            continue;
        }
        const footnote = line.match(/^\[\^([\w-]+)\]:\s*(.*)$/);
        if (footnote) {
            closeList();
            notes.set(footnote[1], footnote[2]);
            continue;
        }
        if (!line.trim()) {
            closeList();
            continue;
        }
        if (line.trimStart().startsWith('|') && /^\s*\|\s*:?-{3}/.test(lines[index + 1] || '')) {
            closeList();
            const rows: string[] = [line];
            while (index + 2 < lines.length && lines[index + 2].trimStart().startsWith('|')) {
                index += 1;
                rows.push(lines[index + 1]);
            }
            const cells = (row: string) => row.split('|').slice(1, -1).map((cell) => cell.trim());
            output.push(renderTable(theme, rows.map(cells), inline));
            index += 1;
            continue;
        }
        if (line.startsWith('# ')) {
            closeList();
            closeQuestion();
            output.push(renderHeading(theme, 1, inline(line.slice(2), headingSize(theme, 1)), '', escapeHtml(_eyebrow)));
            continue;
        }
        if (line.startsWith('## ')) {
            closeList();
            closeQuestion();
            if (edu) {
                output.push(`<section style="${wechatTextStyle(bodyFontSize)};margin:24px 0;padding:20px 18px 8px;border:1px solid ${palette.line};border-top:4px solid ${palette.ink};background-color:${palette.paper};box-sizing:border-box;max-width:100%">`);
                questionOpen = true;
            } else if (tech || neo) {
                const frame = tech
                    ? `margin:28px 0;padding:0 0 8px 18px;border-left:2px solid ${palette.ink};`
                    : `margin:28px 0;padding:16px 14px 4px;border:3px solid ${palette.ink};background-color:${palette.paper};`;
                output.push(`<section style="${wechatTextStyle(bodyFontSize)};${frame}box-sizing:border-box;max-width:100%">`);
                questionOpen = true;
            }
            chapterIndex += 1;
            const ch = String(chapterIndex).padStart(2, '0');
            const barNumber = headingNumberFormat === 'none' ? '' : headingNumberFormat === '一' ? chineseChapterNumber(chapterIndex) : headingNumberFormat === '1' ? String(chapterIndex) : ch;
            const barLead = [[headingPrefix, headingLabel, barNumber].filter(Boolean).join(' '), headingSeparator].filter(Boolean).join(' ');
            const h2Size = 21 + intensity * 2;
            const h2Lh = wechatMinLineHeight(h2Size);
            const h2Title = displayHeadingWithoutNumber(line.slice(3));
            const titleInline = inline(h2Title, h2Size, h2Lh);
            if (headingStyleId === 'bar') {
                output.push(renderHeading(theme, 2, titleInline, barLead));
                continue;
            }
            output.push(renderHeadingTemplate(theme, headingStyleId, ch, barLead, h2Size, h2Lh, titleInline, headingIconChar, chineseChapterNumber(chapterIndex), chipInk, accentLabel));
            continue;
        }
        if (line.startsWith('### ')) {
            closeList();
            output.push(renderHeading(theme, 3, inline(line.slice(4).trim(), h3Size)));
            continue;
        }
        if (line.startsWith('> ')) {
            closeList();
            const quoteLines=[line.slice(2)];
            if(theme.style.preset) while(index+1<lines.length && /^>(?: |$)/.test(lines[index+1])) quoteLines.push(lines[++index].replace(/^> ?/,''));
            output.push(renderQuote(theme, quoteLines.join('\n'), inline, quoteIndex++));
            continue;
        }
        const unordered = line.match(/^- (.*)$/);
        const ordered = line.match(/^\d+\. (.*)$/);
        if (unordered || ordered) {
            const next = unordered ? 'ul' : 'ol';
            if (list !== next) {
                closeList();
                list = next;
                output.push(`<${next} style="margin:10px 0;padding-left:${ordered ? 30 : 26}px;${wechatTextStyle(16)};color:${palette.ink};text-align:left;list-style-type:${ordered ? 'decimal' : 'disc'};box-sizing:border-box">`);
            }
            output.push(`<li style="${wechatTextStyle(16)};${business || tech ? `margin-bottom:${business ? 6 : 14}px;` : ''}color:${accent};padding-left:${ordered ? 8 : 6}px;list-style-type:${ordered ? 'decimal' : 'disc'};list-style-position:outside;box-sizing:border-box"><span style="color:${palette.ink};${wechatTextStyle(16)}">${inline((unordered || ordered)?.[1] || '', 16, 28)}</span></li>`);
            continue;
        }
        if (line.startsWith('![')) {
            const image = renderImageLine(line);
            if (image !== null) {
                closeList();
                output.push(image);
                continue;
            }
        }
        if (line === '---') {
            closeList();
            output.push(neo
                ? `<p style="margin:26px 0;text-align:center;${wechatTextStyle(16)}"><span style="display:inline-block;padding:4px 8px;border:3px solid ${neoInk};background-color:${accent};color:${neoInk};${wechatTextStyle(12)};font-weight:900;${neoShadow(3)}">＋ ＋ ＋</span></p>`
                : `<hr style="margin:26px 0;border:0;border-top:1px solid ${pixel ? pink : accent}">`);
            continue;
        }
        closeList();
        output.push(renderParagraph(theme, line, inline, !paragraphSeen && theme.style.design === 'portrait'));
        paragraphSeen = true;
    }
    closeList();
    if (inCode)
        output.push('</span></section></section>');
    closeQuestion();
    output.push(renderFootnotes(theme, Array.from(notes.entries()), inline));
    // Keep mono + local body stacks; strip exotic web fonts.
    let article = output.join('').replace(/font-family:(?![^;]*(?:Menlo|Monaco|Consolas|ui-monospace|monospace|PingFang|Microsoft YaHei|Noto Sans|Noto Serif|Songti|SimSun|Kaiti|KaiTi|FangSong|STFangsong|LXGW|Zhuque|system-ui))[^;]+;?/gi, '');
    // Hard guarantee: never ship inherit for font-size / line-height
    article = article
        .replace(/font-size:\s*inherit/gi, 'font-size:16px')
        .replace(/line-height:\s*inherit/gi, `line-height:${wechatMinLineHeight(16)}px`);
    const pad = Math.max(12, Math.min(sidePadding, 36));
    article = enforceWechatCompliance(article).html;
    const padY = Math.max(8, Math.min(Number.isFinite(reading.padY) ? Number(reading.padY) : findStyle(styleId).reading.padY, 60));
    const requestedTexture = reading.paperTextureUrl?.trim() || '';
    const remoteTexture = /^https:\/\/[^'"<>\s]+$/.test(requestedTexture) ? requestedTexture : '';
    const texture = theme.style.design === 'cotton' && palette.paper === stylePaper ? remoteTexture : '';
    return enforceWechatCompliance(renderArticleShell(theme, article, pad, padY, texture)).html;
}
