const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,filename);
const {auditWechatHtml}=require('../lib/wechat-compliance.ts');
const {wechatTextStyle}=require('../lib/wechat-typography.ts');
const out=path.resolve(__dirname,'../public/original-article-studies');
const t=(tag,body,size,extra='')=>`<${tag} style="${wechatTextStyle(size,extra)}">${body}</${tag}>`;
const p=(body,size=16,extra='')=>t('p',body,size,`margin:0 0 20px;${extra}`);
const s=(body,extra='')=>t('section',body,16,extra);
const caption=(body,extra='')=>p(body,11,`color:#8b8980;${extra}`);
const serif='font-family:Songti SC,SimSun,serif;';
const paper=s(
 caption('慢读笔记 / NOTES 01','letter-spacing:2px;margin-bottom:35px;')+
 p('别急着<br>把判断交出去',32,serif+'color:#343e42;font-weight:600;letter-spacing:1px;margin-bottom:22px;')+
 p('当工具越来越快，人的价值不是继续加速，而是知道何时停下来。',15,serif+'color:#67777c;margin-bottom:32px;')+
 s(caption('01 / 从问题开始','color:#788f96;letter-spacing:1px;margin-bottom:9px;')+
 p('先问清楚，再让它动手',20,serif+'font-weight:600;margin-bottom:14px;')+
 p('“帮我做好一点”很难得到可靠的结果。说清楚要解决什么、给谁看、怎样才算完成，工具才能真正帮上忙。',16,serif),'border-top:1px solid #c7cdc8;padding-top:25px;')+
 s(p('好的工具让人更自由，<br>也更清楚自己在选择什么。',22,serif+'color:#5b747d;margin:0;text-align:center;'),'border-top:1px solid #aab8bc;border-bottom:1px solid #aab8bc;padding:24px 0;margin:32px 0;')+
 caption('02 / 把结果拿回来','color:#788f96;letter-spacing:1px;margin-bottom:9px;')+
 p('省下力气，不省掉判断',20,serif+'font-weight:600;margin-bottom:14px;')+
 p('检查一张表、读完一段文字、验证一次输出。把重复劳动交出去，把最后的决定留在自己手里。',16,serif)+
 caption('— 写给每天与信息相处的人 —','text-align:center;margin:35px 0 0;'),
 'box-sizing:border-box;width:100%;padding:36px 28px 38px;background-color:#f7f7f4;background-image:url(assets/cotton-paper.png);background-repeat:repeat;background-size:420px 420px;color:#333c3d;word-break:break-word;');
const tilted=s(
 caption('IDEA DESK / 灵感便签','color:#2149b6;letter-spacing:2px;margin-bottom:20px;')+
 p('灵感<br>不排队。',43,'font-weight:800;letter-spacing:-1px;color:#203e87;margin-bottom:24px;')+
 s(p('先试一个小想法',21,'margin:0;font-weight:700;color:#ffffff;'), 'background-color:#284eac;padding:13px 15px;display:inline-block;transform:rotate(-2deg);transform-origin:center;margin:5px 7px 28px 6px;')+
 p('别等整个计划都准备好。先选一个小问题，画一张草图，让想法碰一碰现实。',17,'color:#333d4b;margin-bottom:23px;')+
 s(p('01',36,'font-weight:750;color:#d17a65;margin:0;')+p('不必一开始就像个成品',20,'font-weight:700;margin:0 0 12px;color:#203e87;')+p('记下你看见的细节。试一次，再改一次。下一步往往是在动手之后才出现的。',16,'margin:0;color:#414a54;'),'border-top:1px solid #bcc7d5;padding-top:22px;')+
 s(p('先让想法发生，<br>再让它变得更好。',22,'margin:0;font-weight:650;color:#4b3a35;'),'background-color:#edd4c7;border:1px solid #cead98;padding:17px 15px;transform:rotate(1.5deg);transform-origin:center;margin:35px 8px 30px 6px;')+
 `<table style="${wechatTextStyle(13,'width:100%;table-layout:fixed;border-collapse:collapse;margin:18px 0 0;')}"><tbody><tr>`+
 ['观察','记录','试一次'].map((v,i)=>t('td',caption('0'+(i+1),'color:#8091ab;margin:0;')+p(v,16,'color:#203e87;font-weight:650;margin:5px 0 0;'),13,'width:33.33%;padding:12px 4px;border-top:1px solid #a9b7cf;')).join('')+'</tr></tbody></table>'+
 caption('少一点等待，多一点发生。','margin:27px 0 0;color:#7e8691;'),
 'box-sizing:border-box;width:100%;padding:32px 27px 36px;background-color:#f7f3e9;color:#333d4b;word-break:break-word;');
const head='<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>楷排 · 原创文章排版实验</title></head>';
const cases=[['paper','整幅纸纹 · 可编辑文章',paper],['tilted','倾斜便签 · 可编辑文章',tilted]];
fs.mkdirSync(out,{recursive:true});
const validation={platformVerified:false,source:'https://github.com/wechatjs/verify-article-structure-spec/blob/main/verify_article_structure.md',caveat:'The spec discusses background-image and transforms; static and browser checks do not confirm paste-save-mobile behavior. Assets must be uploaded to WeChat and local URLs replaced.',cases:[]};
for(const [id,name,html]of cases){
 const violations=auditWechatHtml(html);if(violations.length)throw Error(JSON.stringify(violations));
 fs.writeFileSync(path.join(out,id+'-fragment.html'),html);
 fs.writeFileSync(path.join(out,id+'.html'),head+'<body style="margin:0">'+html+'</body></html>');
 validation.cases.push({id,name,staticViolations:0});
}
fs.writeFileSync(path.join(out,'long-image-fragment.html'),'<section style="font-size:16px;line-height:29px"><img src="attention-long-image.png" data-w="836" alt="把注意力还给自己：给信息留一道门，把一件事做完整，允许空白存在，把判断留在手里。" style="display:block;width:100%;height:auto"></section>');
fs.writeFileSync(path.join(out,'index.html'),head+'<body style="margin:0;padding:24px;background:#eeeee9;color:#30383b;font-family:system-ui"><h1 style="font-size:23px">原创文章排版实验</h1><p style="max-width:740px;line-height:26px">A：整幅纹理底，文字可编辑。B：小角度倾斜便签，文字可编辑。C：AI 短文字长图，直接作为图片上传。A、B 还需在公众号后台验证粘贴、保存和手机预览，纹理素材需上传后替换地址。</p><p><a href="paper.html">A 单篇 HTML</a> · <a href="tilted.html">B 单篇 HTML</a> · <a href="attention-long-image.png" download>C 下载 AI 长图</a></p><main style="display:flex;align-items:flex-start;gap:24px;flex-wrap:wrap">'+cases.map(([id,name])=>`<section style="width:390px;max-width:100%"><h2 style="font-size:18px">${name}</h2><img src="${id}.png" style="width:100%;height:auto"><p><a href="${id}-fragment.html" download>下载 HTML</a> · <a href="${id}.png" download>下载图片版</a></p></section>`).join('')+'<section style="width:390px;max-width:100%"><h2 style="font-size:18px">AI 短文字长图</h2><img src="attention-long-image.png" style="width:100%;height:auto"></section></main></body></html>');
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(validation,null,2));
console.log('Original paper and tilted HTML generated; static audit passed.');
