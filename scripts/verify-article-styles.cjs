/** Full production renderer checks. Requires Playwright; optional official verifier bundle via WECHAT_VERIFIER_BUNDLE. */
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);
const {styles}=require('../lib/styles.ts'),{markdownToWechat}=require('../lib/wechat-html.ts');
const {chromium}=require('playwright');
const out=path.resolve(__dirname,'../docs/validation/style-replacement');
const image='data:image/jpeg;base64,'+fs.readFileSync(process.env.STYLE_TEST_IMAGE || path.resolve(__dirname,'../docs/validation/style-replacement/photo.jpg')).toString('base64');
const md=`# 让工具更快，让判断更清楚\n\n:::lead\n先把问题说清楚，再决定怎样使用工具。\n:::\n\n## 从一件小事开始\n\n讨论工具时，容易被速度吸引。真正的进展，还需要明确目标、检查结果，给判断留一点时间。\n\n![一张桌子，也可以是想法的起点。](${image})\n\n> 工具让重复劳动更轻，也让人的判断更重要。\n\n## 把结果拿回来\n\n### 需要留下什么\n\n正文中的 **重点判断**，与 ==局部强调== 分开处理。\n\n| 阅读任务 | 结构重点 |\n| --- | --- |\n| 浏览 | 标题与摘要 |\n| 查找 | 目录与步骤 |\n| 深读 | 段落与章节 |\n\n:::compare\n标题：阅读的三个入口\nA｜看见｜先读标题\nB｜理解｜走进正文\nC｜判断｜检查结果\n结论：每一层都应该帮助读者前进一步。\n:::\n\n- 先问清楚问题\n- 再验证输出\n\n1. 留下一次观察\n2. 完成一个小目标\n\n文字和结构共同服务阅读[^1]。\n\n[^1]: 本页为排版示例，不是实验统计。\n\n:::author\n楷排｜文章风格演示\n:::\n`;
async function main(){
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];let verifierControl=null;
 try{
 const page=await browser.newPage({viewport:{width:390,height:900}});
 if(process.env.WECHAT_VERIFIER_BUNDLE){await page.setContent('<body>');await page.addScriptTag({path:process.env.WECHAT_VERIFIER_BUNDLE});verifierControl=await page.evaluate(async()=>{const c=document.createElement('div');c.innerHTML='<p style="font-size:16px;line-height:0px">bad</p>';return await window.VerifyArticleStructure.verifyArticleStructure(c)});assert.equal(verifierControl.isValid,false,'Official verifier must reject a deliberately invalid line height');}

 for(const s of styles){
  const html=markdownToWechat(md,s.accent,'#fff07a',s.id,s.reading.padX,'',{...s.reading,paragraphGap:20});
  fs.writeFileSync(path.join(out,s.id+'.html'),'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0">'+html);
  const widths=[];
  for(const width of [320,390,430,677]){
   await page.setViewportSize({width,height:900});await page.setContent('<body style="margin:0">'+html);
   await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.evaluate(()=>document.fonts.ready);
   const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,outside:[...document.querySelectorAll('h1,h2,h3,p,img,blockquote,table,td,th')].filter(el=>{const r=el.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(el=>el.tagName),tableCells:[...document.querySelectorAll('table')].map(t=>t.rows.length)}));
   assert.equal(check.overflow,false,s.id+' overflow at '+width);assert.equal(check.outside.length,0,s.id+' outside at '+width+JSON.stringify(check));
   widths.push({width,...check});
   if(width===390)await page.locator('body > section').screenshot({path:path.join(out,s.id+'.png')});
   await page.evaluate(()=>document.querySelectorAll('[style]').forEach(el=>el.style.removeProperty('font-family')));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,s.id+' font fallback overflow');
  }
  let official=null;
  if(process.env.WECHAT_VERIFIER_BUNDLE){
   await page.setViewportSize({width:677,height:900});await page.setContent('<body>');
   await page.addScriptTag({path:process.env.WECHAT_VERIFIER_BUNDLE});
   official=await page.evaluate(async html=>{const container=document.createElement('div');container.innerHTML=html;return await window.VerifyArticleStructure.verifyArticleStructure(container);},html);
   assert.equal(official.isValid,true,s.id+' official structure failure: '+JSON.stringify(official.inValidInfo));
   // Keep findings intact. Typography notices are not silently discarded.
  }
  results.push({id:s.id,name:s.name,widths,official});
  console.log(s.name+': mobile checks passed'+(official?' / official: '+Object.keys(official.inValidInfo).join(',') : ''));
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({wechatBackendVerified:false,verifierControl,results},null,2));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
