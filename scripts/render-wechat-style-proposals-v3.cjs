const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText, filename);
const {auditWechatHtml} = require('../lib/wechat-compliance.ts');
const {wechatTextStyle} = require('../lib/wechat-typography.ts');
const out=path.resolve(__dirname,'../public/style-proposals-v3');
const tx=(tag,body,size=16,css='')=>`<${tag} style="${wechatTextStyle(size,css)}">${body}</${tag}>`;
const para=(body,css='',size=16)=>tx('p',body,size,`margin:0 0 18px;${css}`);
const note=(body,css='')=>para(body,`color:#8c887f;${css}`,12);
const span=(body,css='',size=16)=>tx('span',body,size,css);
const box=(body,css='')=>tx('section',body,16,css);
const title='AI 工具，真的能替你干活吗？';
const quotation='工具不会替你思考，它只会放大你已有的习惯。';
const first=(mark)=>`我用了三个月，结论只有一句：${mark || '先从小事开始'}，别一上来就交给它整个项目。`;
const second='把结果拿回来检查，再决定下一步交给它什么。';
const items=[['整理表格','可用'],['写周报','需修改'],['算工程量','不可靠']];
const themes=[
 ['knowledge','极简知识','#ffffff','#376da3','无框灰色引语','蓝色轻编号','加粗与细下划线','三线表','全篇文字与表格可编辑；使用平台默认字体'],
 ['opinion','自媒体观点','#fffefd','#df5837','大引号与居中判断','局部荧光下划线','小面积荧光标记','硬边表格与状态符号','全篇可编辑；大引语通过字号和间距实现'],
 ['tech','科技媒体','#f4fafb','#139caf','深色终端注释行','等宽编号与信号色','青色加粗','参数网格','正文可编辑；等宽字体跨端可能回退'],
 ['business','商务简报','#ffffff','#1e3d67','改为核心结论卡','深蓝方块编号','深蓝字重','斑马纹与行动清单','全篇可编辑；不依赖复杂定位'],
 ['research','研究报告','#fffdf8','#a47c35','出处明确的小字引用','数字编号与宋体','上标说明','三线表、表题与注记','宋体是可回退的增强；平台默认字体下结构仍成立'],
 ['editorial','纸感 Editorial','#f7f4ec','#4c473c','上下细线之间的大引语','章号与宋体','首段字级变化','无表头的目录式信息','纸纹刊头为 PNG，须上传素材；正文可编辑，宋体可回退'],
 ['edu','教育科普','#f7faff','#3b6fd5','虚线划重点','STEP 编号胶囊','先说答案与易错提示','浅色表头','全篇可编辑；结论与提示不依赖图片'],
 ['corp','企业宣发','#ffffff','#913443','细线之间的品牌宣言','短横与粗体','品牌色字重','三项数据条','数据条使用真实表格等分列；手机宽度已检查'],
 ['event','活动发布','#fbf9ff','#7950d9','票券式引语','议程编号与侧线','重要信息卡','纵向时间线','时间、形式和报名为示例信息，不自动添加到用户文章'],
 ['festival','节日专题','#fff8ef','#b6402f','题跋式引语与印章','居中题签与点饰','朱红着重','朱红表头、细双线','宋体为可回退增强；印章用真实文字与底色实现'],
 ['boldneo','Soft NEO 粗犷','#fff9e6','#111111','硬边便签与阶梯阴影','蓝色贴纸','粉色标记','硬边框与蓝色表头','不使用旋转；阴影由嵌套实色底层实现'],
 ['pixelpost','像素刊物','#141320','#6df5ac','绿色注释与侧线','洋红 ## 章节标记','反色信号块','虚线终端表','正文保持可编辑；等宽字体可能回退；深色效果待微信实测'],
];
const heading=(body,css='',size=20)=>para(body,`margin:26px 0 18px;font-weight:650;${css}`,size);
const headingTitle=(css='',size=27)=>para(size>=26?title.replace('，','，<br>'):title,`font-weight:700;margin:12px 0 26px;${css}`,size);
function table(id,accent) {
 const serif=['research','festival'].includes(id);
 const tri=['knowledge','research'].includes(id);
 const neo=id==='boldneo', dark=id==='pixelpost';
 const border=neo?'3px solid #171715':id==='opinion'?'2px solid #252723':id==='festival'?'1px solid #bc943e':dark?'1px dashed #6b6284':id==='tech'?'1px solid #27a4b5':tri?'none':'1px solid #d4d9dd';
 const headBg=neo?'#51b9e2':dark?'#141320':id==='tech'?accent:id==='business'?accent:id==='festival'?'#b6402f':id==='opinion'?'#df5837':id==='edu'?'#dde8fc':'#ffffff';
 const headInk=dark?'#f266a9':['tech','business','festival','opinion'].includes(id)?'#ffffff':'#22272e';
 let html=`<table style="${wechatTextStyle(14,`width:100%;border-collapse:collapse;table-layout:fixed;margin:22px 0 12px;border:${border};${serif?'font-family:Songti SC,SimSun,serif;':''}`)}"><tbody>`;
 [['场景','能用吗'],...items].forEach((row,i)=>{
  html+='<tr>'+row.map((value,j)=>{
   let v=value;
   if(id==='opinion'&&i&&j)v=span(['','✓','△','×'][i],`color:${['','#218c56','#c58a20','#d54e36'][i]};font-weight:700;margin-right:7px;`,17)+value;
   const line=tri?(i===0||i===3?'2px solid #34332e':'1px solid #d0cabd'):border;
   return tx(i?'td':'th',v,14,`width:50%;padding:10px 8px;text-align:left;color:${i?(dark?'#d1d0ef':id==='festival'?'#563b31':'#272b2e'):headInk};font-weight:${i?(neo?'600':'400'):'650'};background-color:${i?(id==='business'&&i%2?'#f2f5fb':id==='festival'?'#fff1df':neo?'#ffffff':dark?'#141320':'transparent'):headBg};${tri?'border-top:'+(i===0?'2px solid #34332e':'none')+';':''}border-bottom:${line};${!tri?'border-right:'+border+';':''}`);
  }).join('')+'</tr>';
 });return html+'</tbody></table>';
}
function directory() {return box(items.map(row=>para(span(row[0],'display:inline-block;width:64%;',15)+span(row[1],'display:inline-block;width:36%;text-align:right;',15),'border-bottom:1px solid #c9c3b8;padding:11px 0;margin:0;',15)).join(''),'margin:26px 0 0;');}
function make(c) {
 const [id,,paper,accent]=c;
 let content='', pads='28px 24px 32px';
 switch(id) {
  case 'knowledge': content=headingTitle('padding-bottom:16px;border-bottom:1px solid #dedfdc;',25)+heading(span('01','color:'+accent+';margin-right:7px;',14)+'先从小事开始','',19)+para(first(span('先从小事开始','font-weight:650;border-bottom:2px solid #376da3;')))+para(quotation,'color:#858783;font-style:italic;margin:28px 0;',16)+table(id,accent)+note('先验证一个结果，再扩大任务范围。','margin-top:24px;');break;
  case 'opinion':content=headingTitle('',31)+heading(span('先从小事开始','background-color:#ffe86b;font-weight:700;',21),'margin-top:24px;',21)+para(first(span('先从小事开始','background-color:#ffe86b;padding:0 3px;font-weight:700;')))+para('“','text-align:center;color:'+accent+';margin:20px 0 0;',46)+para(quotation,'font-weight:700;text-align:center;margin:0 0 24px;',21)+table(id,accent);break;
  case 'tech':content=box(note('SIGNAL / 01','color:#60d3df;font-family:Menlo,Consolas,monospace;letter-spacing:2px;')+headingTitle('color:#ffffff;margin:0;',26),'background-color:#0d1521;padding:25px 24px;')+box(heading('[01] 先从小事开始','color:'+accent+';font-family:Menlo,Consolas,monospace;margin-top:0;',19)+para(first())+box(para('&gt; '+quotation,'color:#75d8e1;margin:0;',15),'background-color:#0d1521;padding:16px 14px;margin:24px 0;border-radius:3px;')+table(id,accent),'padding:24px;');pads='0';break;
  case 'business':content=headingTitle('color:'+accent+';',25)+box(note('KEY FINDING · 核心结论','color:'+accent+';font-weight:700;letter-spacing:1px;margin-bottom:6px;')+para(quotation,'font-weight:650;margin:0;',17),'background-color:#f2f5fb;border-left:4px solid '+accent+';padding:15px 16px;')+heading(span('01','background-color:'+accent+';color:white;padding:3px 7px;margin-right:8px;',14)+'先从小事开始','color:'+accent+';',19)+para(first())+table(id,accent)+para(span('行动建议','font-weight:650;color:'+accent+';',14)+'　□ 先检查结果<br>　　　　　□ 每周复盘一次','border-top:1px solid #ccd6e5;padding-top:14px;margin-top:18px;',14);break;
  case 'research':content=note('RESEARCH NOTE / 观察记录','letter-spacing:1px;')+headingTitle('font-family:Songti SC,SimSun,serif;text-align:center;border-bottom:2px solid #a47c35;padding-bottom:14px;',26)+box(para(span('摘要','color:'+accent+';font-weight:650;',15)+'　三个月使用记录显示，应从小事开始。','margin:0;font-family:Songti SC,SimSun,serif;',15),'background-color:#f4efe3;border-left:2px solid '+accent+';padding:12px;')+heading('1　先从小事开始','font-family:Songti SC,SimSun,serif;',20)+para(first(span('先从小事开始')+tx('sup','1',11,'color:'+accent+';')),'font-family:Songti SC,SimSun,serif;')+para(quotation,'font-family:Songti SC,SimSun,serif;color:#77705f;text-indent:1em;margin:22px 0 6px;',15)+note('—— 出处：作者使用笔记','text-align:right;')+note('表 1　场景适用性','font-family:Songti SC,SimSun,serif;text-align:center;margin:24px 0 0;')+table(id,accent)+note('¹ 数据为个人三个月的使用记录。','border-top:1px solid #ded1b3;padding-top:10px;margin-top:10px;');break;
  case 'editorial':content='<img src="assets/editorial-masthead.png" data-w="1080" alt="AI 工具，真的能替你干活吗？ 关于工具、习惯和自己的判断" style="display:block;width:100%;height:auto;">'+box(heading(span('§ 01','color:#969083;margin-right:8px;letter-spacing:1px;',13)+'先从小事开始','font-family:Songti SC,SimSun,serif;margin-top:0;',21)+para(span('我','font-family:Songti SC,SimSun,serif;font-weight:650;',30)+'用了三个月，结论只有一句：先从小事开始，别一上来就交给它整个项目。','font-family:Songti SC,SimSun,serif;')+para(quotation,'font-family:Songti SC,SimSun,serif;font-style:italic;font-size:21px;line-height:38px;text-align:center;border-top:2px solid #4a453b;border-bottom:2px solid #4a453b;padding:18px 2px;margin:25px 0;')+directory(),'padding:24px 24px 32px;');pads='0';break;
  case 'edu':content=headingTitle('',26)+box(note('ANSWER · 先说答案','color:'+accent+';font-weight:700;letter-spacing:1px;margin-bottom:4px;')+para('能，但要从小事开始，别一上来就交给它整个项目。','margin:0;',17),'background-color:#e5edff;padding:14px 15px;border-radius:12px;')+heading(span('STEP 01','background-color:'+accent+';color:white;border-radius:15px;padding:2px 9px;margin-right:7px;',13)+'先从小事开始','',19)+para(first())+box(para(span('划重点','color:'+accent+';font-weight:700;',16)+' '+quotation,'margin:0;',16),'border:2px dashed '+accent+';padding:12px 14px;border-radius:10px;margin:22px 0;')+table(id,accent)+box(para(span('易错提醒','color:#a5771c;font-weight:650;',14)+'　不要一次交出整个项目。','margin:0;',14),'background-color:#fff2cc;border-radius:8px;padding:12px 14px;margin-top:16px;');break;
  case 'corp':content=note('品牌观察 · BRAND NOTE','color:'+accent+';letter-spacing:2px;border-bottom:4px solid '+accent+';padding-bottom:12px;')+headingTitle('',28)+heading('先从小事开始','border-top:3px solid '+accent+';padding-top:12px;display:inline-block;margin-top:0;',20)+para(first(span('先从小事开始','color:'+accent+';font-weight:700;')))+box(note('品 牌 宣 言','text-align:center;color:'+accent+';font-weight:700;margin-bottom:10px;')+para(quotation,'margin:0;text-align:center;font-weight:700;',20),'border-top:1px solid '+accent+';border-bottom:1px solid '+accent+';padding:17px 0;margin:26px 0;')+`<table style="${wechatTextStyle(14,'width:100%;table-layout:fixed;border-collapse:collapse;margin:24px 0;')}"><tbody><tr>`+items.map(([label,value])=>tx('td',para(value,'color:'+accent+';font-weight:700;text-align:center;margin:0;',19)+note(label,'text-align:center;margin:6px 0 0;'),14,'width:33.33%;border:1px solid #dfc5c8;padding:14px 4px;')).join('')+'</tr></tbody></table>'+note('品牌表达，始于自己的判断。','color:'+accent+';text-align:center;');break;
  case 'event':content=box(note('LIVE EVENT','color:#e4dbff;letter-spacing:3px;')+headingTitle('color:#ffffff;margin:0;',27),'background-color:'+accent+';padding:25px 24px;')+box(box(para(span('时间','color:'+accent+';font-weight:650;',14)+'　10 月 18 日 20:00','margin-bottom:8px;',14)+para(span('形式','color:'+accent+';font-weight:650;',14)+'　线上分享','margin-bottom:8px;',14)+para(span('报名','color:'+accent+';font-weight:650;',14)+'　免费 · 示例信息','margin:0;',14),'border:2px solid '+accent+';border-radius:10px;padding:12px 16px;')+heading('议程 01　先从小事开始','border-left:4px solid '+accent+';background-color:#ede6fc;padding:10px 12px;',18)+para(first())+box(note('嘉宾金句','color:'+accent+';font-weight:650;margin-bottom:5px;')+para(quotation,'margin:0;',16),'border:2px dashed '+accent+';border-radius:10px;padding:12px 15px;margin:23px 0;')+box(items.map(([label,value],i)=>para(span('●','color:'+accent+';margin-right:8px;',15)+span(label,'font-weight:650;',15)+'　'+value,'margin:0 0 12px;padding:4px 0 4px 12px;',15)).join(''),'border-left:2px solid '+accent+';margin-left:5px;'),'padding:24px;');pads='0';break;
  case 'festival':content=note('·　寒　露　·','color:#b38130;text-align:center;letter-spacing:3px;margin:8px 0 20px;')+headingTitle('font-family:Songti SC,SimSun,serif;text-align:center;color:#4d3026;border-top:3px double #b38130;border-bottom:3px double #b38130;padding:19px 0;',28)+heading('◆ 先从小事开始 ◆','font-family:Songti SC,SimSun,serif;color:'+accent+';text-align:center;',21)+para(first(span('先从小事开始','color:'+accent+';border-bottom:2px dotted '+accent+';')),'font-family:Songti SC,SimSun,serif;color:#4d3026;')+para(quotation+' '+span('楷','background-color:'+accent+';color:white;font-weight:700;border-radius:3px;padding:2px 4px;',15),'font-family:Songti SC,SimSun,serif;border-top:1px solid #b38130;border-bottom:1px solid #b38130;padding:18px 0;color:#4d3026;margin:24px 0;',18)+table(id,accent);break;
  case 'boldneo':content=box(box(headingTitle('margin:0;',28),'background-color:#ffdf56;border:3px solid #181917;padding:14px 12px;margin-right:4px;margin-bottom:4px;'),'background-color:#181917;padding:0 0 2px 0;margin:0 0 24px 0;')+para('先从小事开始','display:inline-block;background-color:#51b9e2;border:3px solid #181917;font-weight:700;padding:4px 10px;',20)+para(first(span('先从小事开始','background-color:#ff91ba;font-weight:700;padding:0 3px;')))+box(box(para(quotation,'font-weight:700;margin:0;',18),'background-color:#fff1a3;border:3px solid #181917;padding:14px;margin-right:4px;margin-bottom:4px;'),'background-color:#181917;padding-bottom:2px;margin:24px 0;')+table(id,accent);pads='28px 22px 32px';break;
  case 'pixelpost':content=note('BOOT v0.92 ........ [OK]','color:#81769e;font-family:Menlo,Consolas,monospace;')+headingTitle('color:#6df5ac;font-family:Menlo,Consolas,monospace;',26).replace('AI 工具，','&gt; AI 工具，').replace('干活吗？','干活吗？ _')+heading('## 先从小事开始','font-family:Menlo,Consolas,monospace;color:#f569ac;',20)+para(first(span('先从小事开始','color:#111721;background-color:#6df5ac;padding:0 2px;')),'color:#d1d0ef;font-family:Menlo,Consolas,monospace;')+para('// '+quotation,'border-left:3px solid #6df5ac;padding-left:13px;color:#6df5ac;font-family:Menlo,Consolas,monospace;margin:26px 0;',17)+table(id,accent)+note('[ EOF ]','color:#81769e;font-family:Menlo,Consolas,monospace;margin-top:18px;');break;
 }
 return box(content,`box-sizing:border-box;width:100%;background-color:${paper};color:${id==='pixelpost'?'#d1d0ef':'#272723'};padding:${pads};word-break:break-word;text-align:left;`);
}
const head='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>楷排 · 案例吸收后的 12 套文章排版</title>';
const css='<style>*{box-sizing:border-box}body{margin:0;background:#202126;font-family:system-ui,-apple-system,"PingFang SC",sans-serif}.sheet{width:1260px;display:grid;grid-template-columns:repeat(3,396px);gap:18px;padding:0 18px 20px}.card{display:flex;flex-direction:column;border:3px solid #e9e6db;border-radius:16px;overflow:hidden;background:#e9e6db}.label{padding:14px 16px;background:#efe7d2;color:#282925;font-size:18px;font-weight:700;line-height:26px}.label small{float:right;font-size:12px;font-weight:400;color:#66604e}.article{flex:1}.notes{padding:14px 16px;background:#24252c;color:#c7c4b6;font-size:12px;line-height:21px;min-height:155px}.notes b{color:#ecece5}.notes .compat{border-top:1px solid #55545a;padding-top:7px;margin-top:7px;color:#a8ab9c;font-size:11px}.top{color:#eeece4;padding:22px 20px;width:1260px}.top h1{margin:0 0 7px;font-size:24px}.top p{font-size:12px;margin:0;color:#aaa99e}.nav{padding:20px;color:#c9c9bf;max-width:1260px;line-height:30px}.nav a{color:#ded6bd}</style>';
function main(){
 fs.mkdirSync(out,{recursive:true});
 const report={source:'https://github.com/wechatjs/verify-article-structure-spec/blob/main/verify_article_structure.md',platformPasteVerified:false,styles:[]};
 const htmls=themes.map((c,i)=>{
  const html=make(c),violations=auditWechatHtml(html);
  if(violations.length)throw Error(c[0]+JSON.stringify(violations));
  if(/position:|transform:|display:(?:flex|grid)|<svg|<script|<style|background-image|!important/.test(html))throw Error('Complex layout dependency '+c[0]);
  const file=String(i+1).padStart(2,'0')+'-'+c[0]+'.html';
  fs.writeFileSync(path.join(out,file),html);
  fs.writeFileSync(path.join(out,c[0]+'-preview.html'),head+'</head><body style="margin:0">'+html+'</body></html>');
  report.styles.push({id:c[0],name:c[1],file,staticViolations:0,fontFallback:/font-family/.test(html),imageUploadRequired:c[0]==='editorial',caveat:c[8]});return html;
 });
 const cards=(start,end)=>themes.slice(start,end).map((c,j)=>`<article class="card"><header class="label">${start+j+1}　${c[1]}<small>${c[0]==='editorial'?'纸纹刊头＋可编辑正文':c[0]==='boldneo'?'便签 · 硬边':c[0]==='pixelpost'?'终端 · 全等宽':'实际 HTML'}</small></header><div class="article" style="background-color:${c[2]}">${htmls[start+j]}</div><footer class="notes"><b>引用</b>　${c[4]}<br><b>二级标题</b>　${c[5]}<br><b>重点</b>　${c[6]}<br><b>表格</b>　${c[7]}<div class="compat">${c[8]}。后台保存及手机预览待实测。</div></footer></article>`).join('');
 for(let g=0;g<4;g++)fs.writeFileSync(path.join(out,`sheet-${g+1}.html`),head+css+'</head><body><header class="top"><h1>楷排 · 12 套文章排版 '+(g+1)+'/4</h1><p>参照案例重新实现 / 正文阅读宽度约 390px / 实际 HTML 截图 / 保留每套不同的阅读语言</p></header><main class="sheet">'+cards(g*3,g*3+3)+'</main></body></html>');
 fs.writeFileSync(path.join(out,'index.html'),head+css+'</head><body><header class="top"><h1>楷排 · 案例吸收后的 12 套文章排版</h1><p>以下是实际 HTML 渲染，不是微信公众号后台截图。基础样式已作静态检查，字体回退与深色效果需实测。</p></header><nav class="nav">'+report.styles.map(r=>`<a href="${r.id}-preview.html">${r.name}：查看单篇</a> / <a href="${r.file}" download>HTML</a>`).join('<br>')+'<p>纸纹刊头需先上传 <a href="assets/editorial-masthead.png" download>PNG 素材</a> 到公众号；正文保持可编辑。字体可回退版本：<a href="editorial-text-fallback.html">杂志纯文字版</a>。</p></nav>'+[0,1,2,3].map(g=>'<main class="sheet">'+cards(g*3,g*3+3)+'</main>').join('')+'</body></html>');
 const fallback=make(themes[5]).replace(/<img[^>]+>/,note('ISSUE 01 / THE WORK NOTES','letter-spacing:2px;padding:25px 24px 0;')+headingTitle('font-family:Songti SC,SimSun,serif;padding:0 24px;',30));
 fs.writeFileSync(path.join(out,'editorial-text-fallback.html'),head+'</head><body style="margin:0">'+fallback+'</body></html>');
 fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));
 console.log('12 styles generated; static audit: zero violations. Platform verification remains pending.');
}
main();
