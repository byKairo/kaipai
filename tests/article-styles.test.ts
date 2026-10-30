import { codeSkin, emphasisStyle, styleUseCases } from '../lib/article-styles/visual-rules';
import type { Theme } from '../lib/article-styles/elements';
import assert from 'node:assert/strict';
import { styles } from '../lib/styles';
import { markdownToWechat, htmlToPlainText } from '../lib/wechat-html';
import { auditWechatHtml } from '../lib/wechat-compliance';
import { wechatResourceNotice } from '../lib/wechat-resources';
import { normalizedPresetAppearance } from '../app/workspace/appearance';
import { parseStyle, wechatMinLineHeight } from '../lib/wechat-typography';
import { resolveArticleHighlight } from '../lib/article-styles/highlight';
import { contrastRatio, paletteForArticle } from '../lib/article-styles/palette';

assert.deepEqual(styles.map(s=>s.id),['knowledge','opinion','tech','business','corp','research','editorial','edu','event','festival','boldneo','pixelpost'],'Persisted article IDs/order must survive replacement');
assert.equal(new Set(styles.map(s=>s.design)).size,12);
assert.ok(styles.every(s=>!['案例档案','现场指南'].includes(s.name)));
const render=(id:string,md:string,extra:Parameters<typeof markdownToWechat>[6]={})=>{
 const s=styles.find(s=>s.id===id)!;
 return markdownToWechat(md,s.accent,'#fff07a',s.id,s.reading.padX,'',{...s.reading,...extra});
};
const highlightColors = new Set<string>();
for (const style of styles) {
 const palette = paletteForArticle(style.id, style.paper);
 for (const background of [style.paper, palette.surface, palette.quote]) {
  assert.ok(contrastRatio(palette.ink, background) >= 4.5, `${style.id}: body and component text contrast`);
  assert.ok(contrastRatio(palette.muted, background) >= 4.5, `${style.id}: captions remain readable across paper and cards`);
 }
 const componentHtml = render(style.id, ':::callout\n核心判断\n:::\n\n:::follow\ncard|关注标题|关注说明|关注按钮||https://example.com/follow\n:::');
 assert.ok(componentHtml.includes(`background-color:${palette.surface}`), `${style.id}: components share the article surface palette`);
 if (!['boldneo', 'pixelpost'].includes(style.id)) {
  const white = paletteForArticle(style.id, '#ffffff');
  assert.equal(white.surface, palette.surface, 'WeChat white keeps the style supporting palette');
 }
 const customDark = paletteForArticle(style.id, '#101010');
 assert.ok(contrastRatio(customDark.ink, customDark.paper) >= 4.5, 'Custom dark paper retains readable fallback');
 const mark = resolveArticleHighlight(style.id, undefined, style.paper);
 highlightColors.add(mark.bg);
 const full = ['boldneo', 'pixelpost'].includes(style.id);
 const html = render(style.id, '正文包含 ==值得注意的重点==，以及 ==第二个重点==。', { paper: style.paper });
 const spans = html.match(/<span style="[^"]*">(?:值得注意的重点|第二个重点)<\/span>/g) || [];
 assert.equal(spans.length, 2, `${style.id}: each marked phrase survives`);
 for (const span of spans) {
  assert.equal(span.includes('linear-gradient(transparent 52%'), !full, `${style.id}: restrained styles use half-height marks`);
  assert.match(span, /box-decoration-break:clone/, 'Wrapped highlights retain a band on each line');
  assert.doesNotMatch(span, /font-weight:/, 'Highlight alone must not force bold');
 }
 const combined = render(style.id, '**==粗体里面加荧光==**，==**荧光里面加粗体**==');
 assert.match(combined, /<strong[^>]*><span[^>]*>粗体里面加荧光<\/span><\/strong>/, 'Highlight preserves existing bold');
 assert.match(combined, /<span[^>]*><strong[^>]*>荧光里面加粗体<\/strong><\/span>/, 'Bold can be added independently inside highlight');
 if (contrastRatio(palette.ink, mark.bg) >= 4.5) assert.equal(mark.color, palette.ink, 'Readable article ink keeps its warm/cool character');
 assert.ok(contrastRatio(mark.color, mark.bg) >= 4.5, `${style.id}: readable highlighted ink`);
 if (!full) assert.ok(contrastRatio(mark.color, style.paper) >= 4.5, `${style.id}: readable uncovered ink`);
 const custom = markdownToWechat('==自选颜色==', style.accent, '#CFE4FF', style.id, 24, '', { paper: '#ffffff' });
 assert.match(custom, /background-color:#CFE4FF/, `${style.id}: manual color overrides automatic color`);
 assert.ok(htmlToPlainText(custom).includes('自选颜色'));
 const dark = resolveArticleHighlight(style.id, '#FFD6E7', '#12131e');
 assert.ok(contrastRatio(dark.color, dark.bg) >= 4.5, 'Custom dark paper keeps the color band readable');
 if (dark.mode === 'half') assert.ok(contrastRatio(dark.color, '#12131e') >= 4.5);
 assert.doesNotMatch(markdownToWechat('==安全颜色==', style.accent, '#fff;position:fixed', style.id), /position:fixed/);
}
assert.ok(highlightColors.size > 1, 'Highlights follow the style palette instead of sharing one universal yellow');
const customInkMark = resolveArticleHighlight('knowledge', undefined, '#ffffff', '#40352f');
assert.equal(customInkMark.color, '#40352f', 'Legible custom body ink survives highlighting');
assert.notEqual(resolveArticleHighlight('knowledge', undefined, '#ffffff', '#eeeeee').color, '#eeeeee', 'Unreadable body ink has a safe highlight fallback');
assert.match(render('knowledge', '==自定义正文色==', { fontColor: '#40352f' }), /color:#40352f[^>]*>自定义正文色/, 'Export passes custom body ink into the mark');
for(const s of styles){
 const html=render(s.id,'# 文章\n\n## 章节\n\n> 判断不能省略。\n\n![图注](https://example.com/original.jpg)\n\n| 项目 | 结论 |\n| --- | --- |\n| A | 保留 |\n\n下一段内容。');
 assert.equal(auditWechatHtml(html).length,0,s.name);
 assert.doesNotMatch(html,/<style|<script|position:(?:absolute|fixed)|height:0|font-size:inherit|line-height:inherit/);
 assert.equal((html.match(/src="https:\/\/example.com\/original.jpg"/g)||[]).length,1,'Decorating a photo must preserve its original source');
 assert.ok(htmlToPlainText(html).includes('下一段内容。'),'A table must not swallow its following paragraph');
 for(const cell of ['项目','结论','A','保留'])assert.ok(htmlToPlainText(html).includes(cell));
}
assert.match(render('boldneo','> 判断不能省略。'),/border-radius:18px 18px 18px 3px/);
const pixel=render('pixelpost','> 判断不能省略。\n\n| 项目 | 结论 |\n| --- | --- |\n| A | 保留 |');
assert.match(pixel,/<blockquote[^>]*border-top:1px solid/);
assert.ok(htmlToPlainText(pixel).includes('判断不能省略。'));
assert.doesNotMatch(htmlToPlainText(pixel), /\/\//, 'Night essays do not inject terminal symbols');
assert.match(pixel,/<th[^>]*color:#d9deed/);
const portrait=render('editorial','讨论空间，先看人。\n\n第二段。');
assert.equal((portrait.match(/float:left/g)||[]).length,1,'Drop only the first eligible paragraph');
assert.doesNotMatch(render('editorial','**重要**内容。\n\n第二段。'),/float:left/,'Do not split emphasis syntax');
assert.doesNotMatch(render('editorial','😀测试内容。'),/float:left/,'Do not split emoji');
for (const fontSize of [14, 16, 20]) for (const lineHeight of [1.8, 2.2]) {
 const bodyLineHeight = Math.max(Math.round(fontSize * lineHeight), wechatMinLineHeight(fontSize));
 const html = render('editorial', '# 为不敢表达的人写的自媒体指南\n\n30 岁以前，我几乎不发朋友圈。\n\n一个典型的理工男，不爱表达。', { fontSize, lineHeight });
 assert.match(html, /<h1\b[^>]*>为不敢表达的人写的自媒体指南<\/h1>/, 'Explicit title stays a heading');
 const caps = Array.from(html.matchAll(/<span style="([^"]*float:left[^"]*)">([^<]*)<\/span>/g));
 assert.equal(caps.length, 1, 'Only the opening body paragraph gets a drop cap');
 assert.equal(caps[0][2], '30', 'Keep an opening number intact');
 const capStyle = parseStyle(caps[0][1]);
 assert.equal(capStyle.height, `${bodyLineHeight * 2}px`, 'Drop cap occupies two body lines at every reading size');
 assert.equal(capStyle['line-height'], capStyle.height);
 assert.ok(Number.parseFloat(capStyle['line-height']) >= wechatMinLineHeight(Number.parseFloat(capStyle['font-size'])));
 assert.ok(htmlToPlainText(html).includes('30 岁以前，我几乎不发朋友圈。'), 'Formatting preserves the opening body text');
 assert.equal(auditWechatHtml(html).length, 0);
}
const original=render('event','![说明](https://example.com/a.jpg)');
assert.doesNotMatch(original,/padding:11px 11px 18px/,'Photography uses full width images, not a polaroid frame');
assert.match(htmlToPlainText(original),/01 \/ 说明/);
assert.match(original,/height:auto/);
const paper=render('knowledge','正文');
assert.doesNotMatch(paper,/background-image:/, 'Column defaults to a clean white page');
assert.equal(wechatResourceNotice(paper), '');
const hosted=render('knowledge','正文',{paperTextureUrl:'https://mmbiz.qpic.cn/example.jpg'});
assert.match(hosted,/background-image:url\('https:\/\/mmbiz.qpic.cn\/example.jpg'\)/);
assert.equal(wechatResourceNotice(hosted),'');
assert.doesNotMatch(render('knowledge','正文',{paperTextureUrl:"https://a.test/a');position:fixed"}),/position:fixed/);
assert.ok(wechatResourceNotice(render('event','![图](data:image/png;base64,AAAA)')).includes('正文图片'));
const notes=render('research','正文[^1]。\n\n[^1]: 原始来源。\n\n```txt\n[^2]: 代码内容\n```');
assert.match(notes,/<sup/);
assert.ok(htmlToPlainText(notes).includes('原始来源。'));
assert.ok(htmlToPlainText(notes).includes('[^2]: 代码内容'));
assert.match(render('research','正文',{fontFamily:'Songti SC;position:fixed'}),/font-size/);
assert.doesNotMatch(render('research','正文',{fontFamily:'Songti SC;position:fixed'}),/position:fixed/);
const a=normalizedPresetAppearance({paperTextureUrl:'https://mmbiz.qpic.cn/example.jpg'} as any,'knowledge');
assert.equal(a.paperTextureUrl,'https://mmbiz.qpic.cn/example.jpg','Texture material survives preset normalization');


const brand = htmlToPlainText(render('corp', ':::compare\n标题：比较\nA｜保留甲｜说明甲\nB｜保留乙｜说明乙\n:::'));
assert.match(brand,/A 保留甲/);
assert.match(brand,/B 保留乙/);
assert.match(htmlToPlainText(render('corp',':::author\n作者名字｜作者说明\n:::')),/作者/);
assert.match(render('pixelpost','==判断=='),/background-color:#a5ddc4;color:#/);

console.log('PASS: style identity, quote signatures, table data, image preservation, drop caps, texture resources and footnotes');

// A style must never promote quoted content into either heading, even when the wording looks like Markdown.
const roleFixture = '# 主标题内容\n\n## 章节标题内容\n\n> 引用内容专属\n\n> ## 引用中的井号仍是引用\n\n正文内容专属';
for (const style of styles) {
 const html = render(style.id, roleFixture);
 const headings = Array.from(html.matchAll(/<h[123]\b[^>]*>([\s\S]*?)<\/h[123]>/g)).map(m => htmlToPlainText(m[1]));
 const quotes = Array.from(html.matchAll(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/g)).map(m => htmlToPlainText(m[1]));
 assert.equal(headings.length, 2, style.id + ': quoted Markdown must not add a heading');
 assert.ok(headings[0].includes('主标题内容'));
 assert.ok(headings[1].includes('章节标题内容'));
 assert.ok(headings.every(text => !text.includes('引用内容') && !text.includes('引用中的')));
 assert.equal(quotes.length, 2);
 assert.ok(quotes[0].includes('引用内容专属'));
 assert.ok(quotes[1].includes('## 引用中的井号仍是引用'));
}
const neoRoles = render('boldneo', roleFixture);
assert.match(neoRoles, /<h2[^>]*display:inline-block[^>]*background-color:#b1d5ee/);
assert.match(neoRoles, /<blockquote[^>]*border-radius:18px 18px 18px 3px[^>]*background-color:#fff0b5/);
const pixelRoles = render('pixelpost', roleFixture);
const pixelTitle = pixelRoles.match(/<h1[^>]*>/)![0];
assert.doesNotMatch(pixelTitle, /border:|background-color:|border-left:|box-shadow:|padding:/);
assert.match(pixelRoles, /<h2[^>]*>[\s\S]*?· · ·/);
assert.match(pixelRoles, /<blockquote[^>]*border-top:1px solid/);

for (const id of ['boldneo', 'pixelpost']) {
 const numbered = render(id, '## 章节标题', {headingNumberFormat:'01',headingPrefix:'章'});
 assert.ok(htmlToPlainText(numbered).includes('章 01'), 'Explicit chapter numbering remains functional');
 const unnumbered = render(id, '## 章节标题');
 assert.ok(!htmlToPlainText(unnumbered).includes('01'), 'Compact designs default to unnumbered labels');
}

// Long tokens must wrap inside narrow headings, quotes, cards and table cells.
for (const style of styles) {
 const token = 'UnbrokenLongValue'.repeat(12);
 const html = render(style.id, `# ${token}\n\n> ${token}\n\n:::callout\n${token}\n:::\n\n| 字段 | 内容 |\n| --- | --- |\n| 参数 | ${token} |`);
 for (const tag of ['h1', 'blockquote', 'td']) {
  const nodes = Array.from(html.matchAll(new RegExp(`<${tag}([^>]*)>`, 'g')));
  assert.ok(nodes.length, style.id + ': stress fixture contains ' + tag);
  assert.ok(nodes.every(node => node[1].includes('overflow-wrap:anywhere')), style.id + ': long content wraps in ' + tag);
 }
 assert.equal(auditWechatHtml(html).length, 0, style.id + ': stress fixture remains compliant');
 assert.ok(htmlToPlainText(html).includes(token), style.id + ': long content is not shortened');
}

// Differences survive removal of color: code frame, header, inset, type and rhythm.
const codeStructures = new Set<string>();
for (const style of styles) {
 const palette = paletteForArticle(style.id, style.paper);
 const theme: Theme = { style, accent: '#ffffcc', ink: palette.ink, muted: palette.muted, paper: palette.paper, line: palette.line, surface: palette.surface, quote: palette.quote, font: '', bodySize: style.reading.fontSize, lineHeight: 30, paragraphGap: style.reading.paragraphGap || 16, imageRadius: 0 };
 const code = codeSkin(theme);
 codeStructures.add(JSON.stringify([code.frame.replace(/#[a-f0-9]{6}/gi, 'COLOR'), code.chrome, code.padding, code.margin, code.size]));
 const weight = emphasisStyle(theme);
 const color = weight.match(/color:(#[a-f0-9]+)/i)![1];
 assert.ok(contrastRatio(color, palette.paper) >= 4.5, style.id + ': emphasis remains readable with a pale custom accent');
 const codeHtml = render(style.id, '\`\`\`js\nconst original = "<safe>&";\n\`\`\`');
 assert.ok(htmlToPlainText(codeHtml).includes('const original = "<safe>&";'), style.id + ': code stays exact');
 assert.ok(styleUseCases[style.design].purpose.length > 0);
}
assert.equal(codeStructures.size, 12, 'All 12 code treatments differ structurally, independently of color');

const columnReading = render("knowledge", "# 标题\n\n正文 **原有重点**\n\n## 章节\n\n后续正文");
assert.match(columnReading, /font-family:[^;]*PingFang/, "Column body is sans serif");
assert.match(columnReading, /<h2[^>]*Songti SC/, "Column chapters use a distinct serif voice");
assert.equal((columnReading.match(/<strong /g) || []).length, 1, "No automatic extra emphasis");
assert.doesNotMatch(columnReading, /background-image:/);
