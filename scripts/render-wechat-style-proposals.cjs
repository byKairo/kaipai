/** Render reviewable article HTML, not an AI-generated illustration. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { auditWechatHtml } = require('../lib/wechat-compliance.ts');
const { wechatTextStyle } = require('../lib/wechat-typography.ts');
const out = path.resolve(__dirname, '../public/style-proposals-v2');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (tag, value, size = 16, extra = '') => `<${tag} style="${wechatTextStyle(size, extra)}">${value}</${tag}>`;
const p = (value, extra = '', size = 16) => text('p', value, size, `margin:0 0 18px;${extra}`);
const small = (value, extra = '') => p(value, `color:#827e78;${extra}`, 11);
const titleText = 'AI 工具，真的能替你干活吗？';
const intro = '用了三个月，我越来越确定：真正有用的，不是把任务一次性交出去，而是找到一个能反复验证的小环节。';
const body = '先从整理表格、梳理资料开始。把结果拿回来检查，再决定下一步交给它什么。';
const quote = '工具不会替你思考，它只会放大你已有的习惯。';
const rows = [['整理表格', '可用'], ['写周报', '需修改'], ['算工程量', '不可靠']];
const configurations = [
  ['minimal', '极简知识', '少装饰，靠层级读懂', '#ffffff', '#4d6c83', '轻编号标题 / 无框引语 / 三线表'],
  ['column', '观点专栏', '让一句判断被记住', '#ffffff', '#8d3d32', '大标题 / 开放式大引语 / 细线数据'],
  ['tech', '科技观察', '理性清晰，不做终端皮肤', '#ffffff', '#426567', '栏目眉题 / 章节横线 / 参数式表格'],
  ['brief', '商务简报', '先给结论，再给依据', '#ffffff', '#254366', '核心结论 / 方块编号 / 行动清单'],
  ['report', '研究报告', '证据和出处有自己的位置', '#fffefb', '#74654e', '摘要 / 引用出处 / 表题与说明'],
  ['magazine', '纸感杂志', '温润底色，舒展阅读', '#f6f3eb', '#5a5247', '刊期 / 分隔线 / 大留白；无纹理依赖'],
  ['guide', '步骤指南', '一眼找到下一步', '#ffffff', '#36665c', '步骤牌 / 要点提示 / 检查清单'],
  ['brand', '品牌故事', '表达有分量，装饰有节制', '#ffffff', '#783a43', '品牌眉题 / 宣言 / 细线表格'],
  ['event', '活动特刊', '把时间与参与方式讲清楚', '#ffffff', '#69603d', '专题头 / 议程式章节 / 信息表'],
  ['culture', '现代中式', '适度留白，少量朱红', '#faf6ef', '#9d4839', '题签 / 对称章节 / 题跋式引语'],
  ['essay', '文化随笔', '读起来轻，留下回味', '#fffdf8', '#696c61', '居中标题 / 空间节奏 / 轻引语'],
  ['pop', '轻快刊物', '活力来自大小与节奏', '#ffffff', '#bd5144', '大编号 / 小面积强调 / 开放式重点'],
];
function table(mode, accent) {
  const base = 'width:100%;border-collapse:collapse;table-layout:fixed;margin:22px 0 12px;';
  const tri = ['minimal','report','magazine','culture','essay'].includes(mode);
  let html = `<table style="${wechatTextStyle(14, base)}"><tbody>`;
  [['场景','能用吗'], ...rows].forEach((row, i) => {
    const stripe = mode === 'brief' && i % 2 === 1;
    html += `<tr>${row.map((v,j) => text(i ? 'td' : 'th', v, 14, `padding:10px 8px;text-align:${j ? 'right' : 'left'};font-weight:${i ? '400' : '600'};${tri ? `border-bottom:1px solid #d5d0c6;${i===0?'border-top:2px solid #383832;':''}${i===3?'border-bottom:2px solid #383832;':''}` : `border-bottom:1px solid #dce0e1;${i===0?`color:${mode==='brief'?'#ffffff':accent};background-color:${mode==='brief'?accent:'#f3f4f2'};`:''}${stripe?'background-color:#f2f5f8;':''}`} `)).join('')}</tr>`;
  });
  return html + '</tbody></table>';
}
function make(c) {
  const [id,name,tagline,paper,accent] = c;
  const h = (value, size = 20, extra = '') => p(value, `font-weight:600;margin:30px 0 18px;${extra}`, size);
  const title = (size = 26, extra = '') => p(titleText, `font-weight:700;margin:12px 0 24px;${extra}`, size);
  const q = extra => p(quote, `margin:28px 0;color:${accent};${extra}`, 18);
  const numbered = n => text('span', n, 13, `color:${accent};margin-right:10px;`);
  let article = '';
  switch (id) {
    case 'minimal': article = title(25) + small('使用笔记 · 观察与判断') + h(numbered('01')+'先从小事开始',19,'border-top:1px solid #e2e4e3;padding-top:20px;') + p(intro) + p(body) + q('color:#727570;') + table(id,accent); break;
    case 'column': article = small('观点 / COLUMN','color:'+accent) + title(30) + p('先从小事开始，而不是一次交出整个项目。','font-weight:600;',18) + p(intro) + p(body) + p('“', 'margin:24px 0 0;text-align:center;color:'+accent,32) + p(quote,'font-weight:600;text-align:center;margin:0 0 26px;',22) + table(id,accent); break;
    case 'tech': article = small('TECH NOTES / 观察 01', 'letter-spacing:1px;color:'+accent) + title(26,'border-bottom:2px solid #26383b;padding-bottom:22px;') + h(numbered('01 /')+'从可验证的任务开始',19) + p(intro) + p(body) + q('border-left:2px solid '+accent+';padding-left:16px;font-size:16px;line-height:29px;') + small('任务适用性 / 使用记录') + table(id,accent); break;
    case 'brief': article = small('工作简报 / EXECUTIVE NOTE') + title(24,'color:'+accent) + text('section',small('核心结论','color:'+accent+';margin-bottom:8px;')+p(quote,'font-weight:600;margin:0;',16),16,'background-color:#f2f5f8;border-left:3px solid '+accent+';padding:16px;') + h(numbered('01')+'先从小事开始',19) + p(intro) + table(id,accent) + small('下一步行动','color:'+accent+';margin-top:24px;') + p('□ 先检查一张表格<br>□ 每周复盘一次结果','margin-bottom:0;',14); break;
    case 'report': article = small('研究笔记 / 使用观察','text-align:center;') + title(24,'text-align:center;') + text('section',p('摘要','color:'+accent+';font-weight:600;margin-bottom:8px;',13)+p(intro,'margin:0;',15),16,'padding:14px 16px;border-top:1px solid #bcb5a7;border-bottom:1px solid #bcb5a7;') + h('1　先从小事开始',19) + p(body) + q('font-size:15px;line-height:27px;') + small('—— 引自作者使用笔记','text-align:right;') + small('表 1　不同任务的适用性','text-align:center;margin-top:28px;margin-bottom:0;') + table(id,accent) + small('说明：此处为排版示例中的个人观察，并非通用能力评测。'); break;
    case 'magazine': article = small('ISSUE 01 / 工作与生活','letter-spacing:2px;') + title(30,'letter-spacing:1px;margin-top:26px;margin-bottom:28px;') + small('三个月的使用笔记','border-bottom:1px solid #bcb7ad;padding-bottom:22px;') + p(intro,'margin-top:28px;') + h(numbered('01')+'先从小事开始',20) + p(body) + q('border-top:1px solid #8b8477;border-bottom:1px solid #8b8477;padding:20px 0;color:#393830;font-size:21px;line-height:38px;') + table(id,accent); break;
    case 'guide': article = small('实践指南 / 从一个小任务开始','color:'+accent) + title(25) + text('section',p('先说答案','color:'+accent+';font-weight:600;margin-bottom:8px;',13)+p('可以帮忙，但每一步都需要验证。','margin:0;',16),16,'padding:16px;background-color:#f0f5f1;') + h(numbered('STEP 01')+'先从小事开始',19) + p(intro) + h(numbered('STEP 02')+'拿回结果，自己检查',19) + p(body) + table(id,accent) + q('font-size:15px;line-height:27px;border-top:1px dashed #b8c8bf;padding-top:18px;'); break;
    case 'brand': article = small('品牌观察 · 工作方式','letter-spacing:2px;color:'+accent+';border-top:3px solid '+accent+';padding-top:16px;') + title(28) + h('先从小事开始',20,'color:'+accent) + p(intro) + p(body) + small('我们的判断','text-align:center;color:'+accent+';margin-top:32px;margin-bottom:12px;') + q('text-align:center;color:#282625;border-top:1px solid '+accent+';border-bottom:1px solid '+accent+';padding:18px 0;font-weight:600;') + table(id,accent); break;
    case 'event': article = small('主题分享 / 使用 AI 的第一步','color:'+accent+';text-align:center;') + title(28,'text-align:center;border-top:1px solid #ccc7b7;border-bottom:1px solid #ccc7b7;padding:18px 0;') + small('议题 01','color:'+accent+';margin-top:28px;margin-bottom:4px;') + h('先从小事开始',20,'margin-top:0;') + p(intro) + small('议题 02','color:'+accent+';margin-top:28px;margin-bottom:4px;') + h('什么值得交给工具？',20,'margin-top:0;') + p(body) + table(id,accent) + q('padding:16px;border:1px dashed #c4bead;font-size:16px;line-height:29px;'); break;
    case 'culture': article = small('·　日 常 札 记　·','text-align:center;letter-spacing:3px;color:'+accent+';margin-top:12px;') + title(27,'text-align:center;border-top:1px solid #c9bbaa;border-bottom:1px solid #c9bbaa;padding:20px 0;') + h('一 / 先从小事开始',19,'text-align:center;color:'+accent) + p(intro) + p(body) + q('border-top:1px solid #c9bbaa;border-bottom:1px solid #c9bbaa;padding:18px 0;text-align:center;color:#4a423a;') + table(id,accent) + small('以小见大，循序而行。','text-align:center;margin-top:26px;'); break;
    case 'essay': article = small('生活笔记','text-align:center;letter-spacing:4px;margin-top:20px;') + title(25,'text-align:center;margin-top:20px;margin-bottom:34px;') + p(intro,'margin-bottom:28px;') + h('先从小事开始',18,'font-weight:500;text-align:center;margin:30px 0;') + p(body,'margin-bottom:28px;') + q('text-align:center;font-size:18px;line-height:33px;padding:22px 10px;border-top:1px solid #d4d2c9;border-bottom:1px solid #d4d2c9;') + table(id,accent) + small('把判断留给自己。','text-align:center;margin-top:26px;'); break;
    case 'pop': article = small('工作也可以轻一点 / DAILY','color:'+accent) + title(30) + p('先从小事开始','display:inline-block;background-color:#fbe9dc;padding:4px 10px;font-weight:600;',19) + p(intro) + p('01','color:'+accent+';font-weight:700;margin:20px 0 0;',36) + h('别急着交出整个项目',20,'margin-top:0;') + p(body) + q('font-weight:600;border-left:4px solid '+accent+';padding-left:16px;color:#2c2a28;') + table(id,accent); break;
  }
  return text('section',article,16,`box-sizing:border-box;width:100%;padding:30px 24px 32px;background-color:${paper};color:#30322f;word-break:break-word;text-align:left;`);
}
const previewHead = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>楷排 · 12 套真实 HTML 排版</title>';
function main() {
 fs.mkdirSync(out,{recursive:true});
 const results=[];
 const articles=configurations.map((c,i)=>{
  const html=make(c); const violations=auditWechatHtml(html);
  if(violations.length) throw new Error(c[0]+' '+JSON.stringify(violations));
  if(/font-family|background-image|position:|display:(?:flex|grid)|transform|<svg|<script|<style|!important/.test(html))throw new Error('Unsupported dependency in '+c[0]);
  const file=`${String(i+1).padStart(2,'0')}-${c[0]}.html`;
  fs.writeFileSync(path.join(out,file),html);
  fs.writeFileSync(path.join(out,`${c[0]}-preview.html`),previewHead+'</head><body style="margin:0">'+html+'</body></html>');
  results.push({id:c[0],name:c[1],file,staticViolations:0});return html;
 });
 const css='<style>*{box-sizing:border-box}body{margin:0;background:#e9e7e1;color:#262722;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}.sheet{width:1248px;padding:24px;display:grid;grid-template-columns:repeat(3,390px);gap:15px}.card{background:white;display:flex;flex-direction:column}.label{background:#242824;color:#f3f1e9;padding:16px 20px;font-size:18px;font-weight:600}.label span{display:block;margin-top:6px;font-size:12px;color:#c6c8bd;font-weight:400}.article{flex:1}.notes{padding:15px 20px;background:#f1f0eb;border-top:1px solid #d6d4cc;color:#68695f;font-size:12px;line-height:22px}.notes strong{color:#42463d} .intro{padding:26px 24px 4px;width:1248px}.intro h1{font-size:24px;margin:0 0 8px}.intro p{font-size:13px;margin:0;color:#71766b}.toolbar{padding:18px 24px}.toolbar a{color:#315c55;margin-right:20px}</style>';
 const cards=(start,end)=>configurations.slice(start,end).map((c,j)=>`<article class="card"><header class="label">${String(start+j+1).padStart(2,'0')}　${c[1]}<span>${c[2]}</span></header><div class="article">${articles[start+j]}</div><footer class="notes"><strong>版式区别</strong>　${c[5]}<br>正文可编辑 · 默认字体 · 静态规则检查通过<br>公众号后台粘贴、保存及手机预览待实测</footer></article>`).join('');
 for(let g=0;g<4;g++)fs.writeFileSync(path.join(out,`sheet-${g+1}.html`),previewHead+css+'</head><body><div class="intro"><h1>楷排 · 文章排版效果 '+(g+1)+'/4</h1><p>同一篇文章 · 390px 阅读宽度 · 从实际内联 HTML 渲染，非生图</p></div><main class="sheet">'+cards(g*3,g*3+3)+'</main></body></html>');
 const links=results.map((r,i)=>`<a href="${r.id}-preview.html">${String(i+1).padStart(2,'0')} ${r.name}</a> <a href="${r.file}" download>下载 HTML</a><br>`).join('');
 fs.writeFileSync(path.join(out,'index.html'),previewHead+css+'</head><body><div class="intro"><h1>12 套文章排版效果</h1><p>保守兼容方案；不是微信公众号后台实测截图。正文保持可编辑，不依赖外部字体、纸纹背景和复杂定位。</p></div><nav class="toolbar">'+links+'</nav>'+[0,1,2,3].map(g=>'<main class="sheet">'+cards(g*3,g*3+3)+'</main>').join('')+'</body></html>');
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({source:'https://github.com/wechatjs/verify-article-structure-spec/blob/main/verify_article_structure.md',platformPasteVerified:false,remarks:'Static check and browser rendering are not platform verification. No mandatory font family or paper texture. Same original sample text for comparisons.',styles:results},null,2));
 console.log('Generated 12 inline HTML fragments and 4 comparison sheets. Static audit: zero violations.');
}
main();
