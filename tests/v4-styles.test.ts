import { resolveArticleHighlight } from '../lib/article-styles/highlight';
import assert from 'node:assert/strict';
import { newStyles, allStyles, styles, findStyle } from '../lib/styles';
import { markdownToWechat,htmlToPlainText } from '../lib/wechat-html';
import { auditWechatHtml } from '../lib/wechat-compliance';
import { contrastRatio,paletteForArticle } from '../lib/article-styles/palette';
const quote='长引用需要连续阅读，不能因为装饰而挤压文字。'.repeat(12);
const body='清晨走进街道，有人整理报纸，有人把椅子搬到门口。'.repeat(30);
const source=`# 长标题与完整内容\n\n${body}\n\n## 一个章节\n\n> ${quote}\n> 第二行引文\n>\n> 引用的第二段\n\n| 项目 | 数据 | 说明 | 负责人 | 时间 |\n| --- | --- | --- | --- | --- |\n| 原始项目 | 123 | 保留说明 | 原始作者 | 2026 |\n\n\`\`\`js\nconst longLine = "${'keep_original_'.repeat(40)}";\n\`\`\`\n\n最后一段。`;
assert.equal(newStyles.length,12);assert.equal(new Set(allStyles.map(s=>s.id)).size,24);
assert.deepEqual(allStyles.slice(0,12),styles,'Persisted indices still resolve to original presets');
for(const s of newStyles){
 assert.equal(findStyle(s.id),s);
 const html=markdownToWechat(source,s.accent,undefined,s.id,s.reading.padX,'',{...s.reading,paper:s.paper});
 const plain=htmlToPlainText(html);
 for(const text of [body,quote,'第二行引文','引用的第二段','原始项目','保留说明','最后一段。','keep_original_'.repeat(40)])assert.ok(plain.includes(text),s.id+': preserve '+text.slice(0,16));
 assert.equal((html.match(/<blockquote /g)||[]).length,1,'Adjacent quote paragraphs form one block');
 assert.match(html, /overflow-x:auto/,'Wide content has its own scroll container');
 assert.match(html, /min-width:500px/,'Five columns keep readable cells');
 assert.equal(auditWechatHtml(html).length,0,s.id+': typography and HTML compliance');
 assert.doesNotMatch(plain,/楷排编辑部|未完待续|某位老编辑|2026.10.22|TL;DR/,'No invented metadata or summary');
 const q=html.match(/<blockquote[^>]*>/)![0];assert.match(q,/text-align:left/,'Long quotes remain left aligned');
 const p=paletteForArticle(s.id,s.paper);
 const linked=markdownToWechat('[原始链接](https://example.com/)',s.accent,undefined,s.id,s.reading.padX,'',{...s.reading,paper:s.paper});
 const linkColor=linked.match(/<a[^>]*style="color:([^;]+)/)?.[1];
 assert.ok(linkColor && contrastRatio(linkColor,p.paper)>=4.5,s.id+': link contrast including dark paper');
 for(const bg of [p.paper,p.surface,p.quote]){assert.ok(contrastRatio(p.ink,bg)>=4.5,s.id+': body contrast');assert.ok(contrastRatio(p.muted,bg)>=4.5,s.id+': caption contrast');}
}
console.log('PASS: 12 v4 presets preserve long articles, multiline quotes, code and tables; legacy IDs/indices retained; no invented content');

for (const style of newStyles) {
 const html = markdownToWechat('正文 **普通加粗** 与 ==金句高亮==，以及 **==叠加强调==**。', style.accent, undefined, style.id, style.reading.padX, '', {...style.reading,paper:style.paper});
 const bold = html.match(/<strong style="([^"]*)">普通加粗<\/strong>/)![1];
 assert.match(bold,/font-weight:700/);
 assert.doesNotMatch(bold,/background(?:-color)?:|linear-gradient|padding:/,style.id+': ordinary bold has no highlight');
 const pal = paletteForArticle(style.id,style.paper);
 const mark = resolveArticleHighlight(style.id, undefined, pal.paper,pal.ink);
 assert.match(mark.css,/font-weight:700/);
 assert.ok(['half','full'].includes(mark.mode));
 assert.ok(contrastRatio(mark.color,mark.bg)>=4.5);
 const explicit = html.match(/<span style="([^"]*)">金句高亮<\/span>/)![1];
 assert.match(explicit,/background-color:/,style.id+': explicit highlight retained');
 assert.ok(explicit.includes(mark.css.replace(/;$/,'')),style.id+': explicit mark uses shared highlight style');
 assert.match(html,/<strong[^>]*><span[^>]*>叠加强调<\/span><\/strong>/,style.id+': combined bold and highlight retained');
 const reverse = markdownToWechat('==**反向叠加**==', style.accent, '#aaccff', style.id);
 assert.match(reverse,/<strong[^>]*><span[^>]*>反向叠加<\/span><\/strong>|<span[^>]*><strong[^>]*>反向叠加<\/strong><\/span>/);
 assert.equal(auditWechatHtml(html).length,0);
 assert.ok(contrastRatio(resolveArticleHighlight(style.id,'#aaccff',style.paper).color,resolveArticleHighlight(style.id,'#aaccff',style.paper).bg)>=4.5);
 assert.equal(resolveArticleHighlight(style.id,undefined,'#ffffff').bg,mark.bg,'Editor and export share the same mark');
}
console.log('PASS: all 12 styles separate plain bold from explicit highlights; combined marks and custom colors retained');
