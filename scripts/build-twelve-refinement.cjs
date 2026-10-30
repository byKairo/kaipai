const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const out=path.resolve('outputs/十二套风格精修');
const original=fs.readFileSync(path.join(out,'原版.html'),'utf8');
const css=original.match(/<style>([\s\S]*?)<\/style>/)[1];
const source=original.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(0,source.indexOf('const $='))+';this.styles=S;this.sample=body;',ctx);
const old=JSON.parse(JSON.stringify(ctx.styles));
const notes=[
['报刊的秩序','保留宋体与章前横线；引语去掉双横线，避免和章节争夺分界。正文加粗维持黑墨，红色只留给章号和明确标记。'],
['纸上的日常','保留暖纸、虚线章题和便签；减淡纸色，加深棕墨，便签拥有虚线边界，代码改用安静纸底。'],
['暗处也清晰','保留深色与青绿侧线；中文引语恢复正体，正文减少字距，说明文字提亮，代码使用同一套夜色。'],
['留白有层次','保留居中章题和无线条表格；缩短过大的字距，章节留白独立于段距，避免整篇松散。'],
['按步骤查阅','保留技术前缀、深色代码和网格表；章号明确递增，引用降为细侧线，长代码可横向滚动。'],
['强烈但有主角','保留黑色标题块、粉色硬阴影；只有章节保留强阴影，引用、表格和提示收轻，避免每块都像海报。'],
['章节像翻页','保留大号数字与黑色大标题；数字变淡、正文强调回到黑墨，红色集中在引语和章号，拉开故事段落。'],
['柔和也有对比','保留胶囊编号、暖灰背景和软卡片；加深棕色文字，降低圆角，代码、引用和提示分出轻重。'],
['墨色为主，朱砂点睛','保留宋体、居中篇题与朱砂章号；缩小正文过宽字距，长章题与印章分列，引用保持疏朗。'],
['终端的节奏','保留方括号、注释引语与绿色虚线；去掉正文发光，正文绿降饱和，亮绿留给章号与代码关键字。'],
['轻快而不幼稚','保留圆形章号、粉色气泡与黄色标记；粉色文字加深，圆角统一，代码彩点减少为文件标签。'],
['信息的优先级','保留深蓝章节带与实色表头；加粗去掉成片底色，引用改成清晰摘要侧线，让数据与章节先被看到。']
];
const changes=[
{ps:'22px',px:24,mu:'#626262',chapter:'48px',after:'20px',opening:'40px'},
{bg:'#faf4e8',ac:'#955b25',mu:'#77634f',ps:'24px',px:24,lh:1.95,ls:'.02em',c:'box',chapter:'48px',after:'22px'},
{mu:'#9aa5b5',ls:'.02em',qs:'normal',px:24,lh:1.95,chapter:'48px',after:'22px'},
{mu:'#737373',fs:'16px',lh:2,ls:'.025em',ps:'28px',px:28,h2:'18px',chapter:'64px',after:'28px',opening:'48px'},
{nf:'{n} /',ps:'18px',fs:'16px',px:22,chapter:'36px',after:'16px'},
{tb:'1px solid #111',ts:'none',b:'w',t:'head',th:'#111',cb:'#fff5bb',ps:'22px',chapter:'44px',after:'22px'},
{b:'w',mu:'#686868',ps:'24px',lh:1.95,h1:'30px',chapter:'56px',after:'24px',opening:'40px'},
{ac:'#80594d',mu:'#75685e',r:'10px',px:24,ls:'.02em',chapter:'48px',after:'22px'},
{mu:'#71695f',ls:'.04em',px:26,chapter:'52px',after:'24px'},
{b:'w',fg:'#b7cbb3',mu:'#87a382',fs:'15px',ps:'20px',chapter:'40px',after:'18px'},
{ac:'#b83759',mu:'#74677f',r:'14px',ls:'.02em',lh:1.95,chapter:'46px',after:'22px'},
{b:'w',q:'bar',ps:'18px',fs:'16px',lh:1.8,chapter:'36px',after:'16px'}
];
const refined=old.map((s,i)=>({...s,...changes[i],idx:i}));
let polished=css.slice(css.indexOf('/* 文章 */'));
function replace(a,b){if(!polished.includes(a))throw Error('Missing CSS '+a);polished=polished.replace(a,b)}
replace('padding:32px var(--px);overflow:hidden','padding:var(--opening,36px) min(var(--px),6.5vw) 44px;overflow-wrap:anywhere');
replace('margin:calc(var(--ps)*1.8) 0 var(--ps)','margin:var(--chapter) 0 var(--after)');
replace('margin:0 0 10px','margin:0 0 18px');
replace('font-weight:700}\n.art h2 i','font-weight:700;text-wrap:pretty}\n.art h2 i');
replace('[data-h=block] h2{width:fit-content','[data-h=block] h2{max-width:calc(100% - 4px);box-sizing:border-box;width:fit-content');
replace('font-size:2.4em;font-weight:900;line-height:1;opacity:.28','font-family:var(--sans);font-size:52px;font-weight:500;line-height:1;margin-bottom:12px;color:var(--ln)');
replace('[data-h=center] h2{text-align:center;font-weight:500;letter-spacing:.3em}','[data-h=center] h2{text-align:center;font-weight:500;letter-spacing:.08em}');
replace('[data-h=seal] h2 i{','[data-h=seal] h2{display:flex;align-items:baseline;gap:12px}\n[data-h=seal] h2 i{flex-shrink:0;');
replace('[data-h=bubble] h2 i{','[data-h=bubble] h2{display:flex;align-items:baseline;gap:10px}\n[data-h=bubble] h2 i{flex-shrink:0;');
replace('.art blockquote{margin:var(--ps) 0;', '.art blockquote{margin:calc(var(--ps) + 10px) 0;');
replace('[data-q=pull] blockquote{text-align:center;font-size:1.25em;padding:16px 8px;border-top:1px solid var(--hc);border-bottom:1px solid var(--hc);color:var(--hc)}','[data-q=pull] blockquote{text-align:left;font-size:1.2em;padding:4px 0 4px 18px;border-left:2px solid var(--ln);color:var(--hc)}');
replace('[data-q=bar] blockquote{background:var(--cb);border-left:4px solid var(--ac);padding:10px 14px;border-radius:0 6px 6px 0}','[data-q=bar] blockquote{background:var(--cb);border-left:2px solid var(--ac);padding:14px 16px;border-radius:0}');
replace('font-size:1.35em;font-weight:800','font-family:var(--serif);font-size:1.3em;font-weight:600');
replace('.art li{margin-bottom:.25em}', '.art li{margin-bottom:.6em}');
replace('letter-spacing:0;overflow:hidden','letter-spacing:0;overflow:hidden');
replace('white-space:pre-wrap;font:inherit','white-space:pre;overflow-x:auto;font:inherit;tab-size:2');
replace('background:#0d1117;color:#c9d1d9','background:#171d27;color:#d6dce5');
replace('[data-c=brut] .code{background:#111;color:#b6ff3b;border:3px solid #111;box-shadow:4px 4px 0 var(--ac)}','[data-c=brut] .code{background:#161616;color:#f2e6a9;border:1px solid #111}');
replace('[data-c=brut] .code .cm{color:#7a9a3a}','[data-c=brut] .code .cm{color:#b4aa87}');
replace('[data-c=hair] .code{border-top:1px solid var(--ln);border-bottom:1px solid var(--ln);color:var(--mu)}','[data-c=hair] .code{border-top:1px solid var(--ln);border-bottom:1px solid var(--ln);color:var(--fg)}');
replace('[data-c=candy] .bar{color:var(--mu)}','[data-c=candy] .bar{color:var(--mu)}[data-c=candy] .bar s{display:none}');
replace('border-radius:var(--r);overflow:hidden','border-radius:var(--r);overflow-x:auto');
replace('font-size:.92em}\n.art th','font-size:.92em;line-height:1.65}\n.art th');
replace('border:var(--tb,1px solid var(--ln));border-radius:var(--r);box-shadow:var(--ts,none);font-size:.95em','border:0;border-left:2px solid var(--ln);border-radius:0;font-size:.95em');
polished+='\n.art *{box-sizing:border-box}.art p:last-child{margin-bottom:0}.art .lead{margin-bottom:32px}.art .tip .tl{margin-bottom:6px}.art .code .kw{color:var(--ac)}[data-c=tab] .code .kw{color:#85bfff}[data-c=brut] .code .kw{color:#ff99bd}.art h3{font-size:1.05em;margin:30px 0 14px;color:var(--hc)}.art a{color:var(--ac);text-decoration:underline;text-underline-offset:3px}.art img{max-width:100%;height:auto}.art .inline-code{font-family:var(--mono);font-size:.88em;background:var(--cb);padding:2px 4px}.art blockquote p{margin-bottom:10px}\n';
const md=JSON.parse(fs.readFileSync('outputs/三套风格打磨/before.json','utf8')).markdown;
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const inline=s=>esc(s).replace(/\*\*(.*?)\*\*/g,'<b>$1</b>');
let number=0;const long=md.split(/\n\s*\n/).map(p=>{p=p.trim();if(p.startsWith('# '))return '<h1>'+inline(p.slice(2))+'</h1>';if(/^#{2,3} /.test(p))return '<h2><i data-number="'+(++number)+'"></i>'+inline(p.replace(/^#+ /,''))+'</h2>';return '<p>'+inline(p.replace(/\n/g,''))+'</p>'}).join('');
const payload={old,refined,notes,css:css.slice(css.indexOf('/* 文章 */')),polished,long,samples:old.map(s=>ctx.sample(s))};
const data=JSON.stringify(payload).replace(/</g,'\\u003c');
const shell=fs.readFileSync('scripts/twelve-refinement-shell.html','utf8').replace('__DATA__',data);
fs.writeFileSync(path.join(out,'十二套风格精修.html'),shell);
fs.writeFileSync(path.join(out,'精修说明.md'),'# 十二套风格精修\n\n基于用户提供的12套样式，保留其名称与视觉身份。仅本地设计候选，未接入正式模板、未发布。真实文章仅展示原有文字和加粗；标题层级沿用上一轮统一输入。\n\n'+notes.map((x,i)=>'## '+old[i].n+'\n\n'+x[1]).join('\n\n'));
console.log('Generated 12 styles, original/refined comparison, sample/real article.');
