import { wechatTextStyle } from '../wechat-typography';
import { escapeHtml } from '../wechat-text';
import type { Theme } from './elements';
import { resolveArticleHighlight } from './highlight';
export function renderHeadingTemplate(theme: Theme, headingStyleId: string, ch: string, barLead: string, h2Size: number, h2Lh: number, titleInline: string, headingIconChar: string, chineseChapter: string, chipInk: string, accentLabel: string) {
    const { accent } = theme;
    const headingMark = resolveArticleHighlight(theme.style.id, undefined, theme.paper, theme.ink);
    const palette = { ink: theme.ink, paper: theme.paper, line: theme.line };
    const base = `margin:28px 0 12px;color:${palette.ink};${wechatTextStyle(h2Size)};font-weight:700;text-align:left;box-sizing:border-box;max-width:100%`;
    const titleSpan = `<span style="${wechatTextStyle(h2Size)};color:${palette.ink}">${titleInline}</span>`;
    let h2Html = '';
    switch (headingStyleId) {
        case 'frame':
            h2Html = `<h2 style="${base};padding:8px 10px;border:0;border-left:6px solid ${accent};background-color:transparent"><span style="display:inline-block;margin-right:8px;color:${accentLabel};${wechatTextStyle(16)};font-weight:900;vertical-align:middle">${ch}</span><span style="vertical-align:middle">${titleSpan}</span></h2>`;
            break;
        case 'twin':
            h2Html = `<h2 style="${base};padding:10px 0 12px;border:0;border-bottom:1px solid ${palette.line};background-color:transparent"><span style="display:block;margin:0 0 6px;${wechatTextStyle(11)};font-weight:700;letter-spacing:.14em;color:${accentLabel}">${ch} /</span>${titleSpan}</h2>`;
            break;
        case 'markerHalf':
            h2Html = `<h2 style="${base};padding:0;border:0;background-color:transparent"><span style="display:inline-block;margin-right:5px;${wechatTextStyle(h2Size)};font-weight:800">${chineseChapter}、</span><span style="display:inline;${headingMark.css}${wechatTextStyle(h2Size)};font-weight:800">${titleInline}</span></h2>`;
            break;
        case 'markerUnder':
            h2Html = `<h2 style="${base};padding:0;border:0;background-color:transparent"><span style="display:inline-block;margin:0 8px 0 0;padding:2px 7px;background-color:${accent};color:${chipInk};${wechatTextStyle(15)};font-weight:800;line-height:1.2;vertical-align:middle">${ch}</span><span style="vertical-align:middle">${titleSpan}</span></h2>`;
            break;
        case 'markerLine':
            h2Html = `<h2 style="${base};padding:0;border:0;background-color:transparent;text-align:center"><span style="display:inline-block;padding:0 1px 6px;border-bottom:4px solid ${accent};${wechatTextStyle(h2Size)};font-weight:800"><span style="margin-right:7px">${ch}</span>${titleInline}</span></h2>`;
            break;
        case 'numberFrame':
            h2Html = `<h2 style="${base};margin-top:38px;padding:0;border:0;background-color:transparent;text-align:center"><span style="display:inline-block;max-width:100%;padding:13px 16px 10px;border:1px solid ${accent};background-color:transparent;box-sizing:border-box"><span style="display:table;margin:-31px auto 7px;padding:0 9px;background-color:${palette.paper};color:${accentLabel};${wechatTextStyle(17)};font-weight:900;line-height:1.2">${ch}</span><span style="${wechatTextStyle(h2Size)};color:${palette.ink};font-weight:800">${titleInline}</span></span></h2>`;
            break;
        case 'iconTag':
            h2Html = `<h2 style="${base};padding:0;border:0;background-color:transparent"><span style="display:inline-block;margin:0 8px 0 0;color:${accentLabel};${wechatTextStyle(16)};font-weight:800">${escapeHtml(headingIconChar)}</span>${titleSpan}</h2>`;
            break;
        case 'avatarLeft':
            h2Html = `<h2 style="${base};padding:0;border:0;background-color:transparent"><span style="display:inline-block;margin:0 10px 0 0;padding:3px 6px;border:1px solid ${accent};border-radius:999px;color:${accentLabel};${wechatTextStyle(11)};font-weight:800;text-align:center;vertical-align:middle;box-sizing:border-box">IP</span><span style="${wechatTextStyle(h2Size)};color:${palette.ink};vertical-align:middle">${titleInline}</span></h2>`;
            break;
        case 'avatarTop':
            h2Html = `<h2 style="${base};padding:0;border:0;background-color:transparent;text-align:center"><span style="display:inline-block;margin:0 0 8px;padding:4px 8px;border:1px solid ${accent};border-radius:999px;color:${accentLabel};${wechatTextStyle(11)};font-weight:800;text-align:center;box-sizing:border-box">IP</span><br>${titleSpan}</h2>`;
            break;
        case 'poster':
            h2Html = `<h2 style="${base};padding:0;border:0;background-color:transparent"><span style="display:block;margin:0;${wechatTextStyle(26)};line-height:1.1;font-weight:900;color:${accentLabel}">${ch}</span>${titleSpan}</h2>`;
            break;
        case 'brand':
            h2Html = `<h2 style="${base};padding:10px 12px;border:1px solid ${accent};background-color:transparent"><span style="${wechatTextStyle(14)};font-weight:800;letter-spacing:.06em;color:${accentLabel}">${ch}｜</span>${titleSpan}</h2>`;
            break;
        case 'bar':
        default:
            h2Html = `<h2 style="${base};padding:7px 9px;border-left:4px solid ${accent};background-color:transparent">${barLead ? `<span style="display:inline-block;margin:0 10px 0 0;${wechatTextStyle(12)};font-weight:800;color:${accentLabel}">${barLead}</span>` : ''}${titleSpan}</h2>`;
            break;
    }
    return h2Html;
}
