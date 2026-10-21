/** Integration acceptance in an isolated browser context; never edits the user's saved articles. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];
 try{
 const context=await browser.newContext({viewport:{width:1500,height:1000},acceptDownloads:true});
 await context.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{value:{write:async(items)=>{window.__copied=await (await items[0].getType('text/html')).text();}}});document.execCommand=(cmd)=>{if(cmd!=='copy')return false;const data=new DataTransfer();document.dispatchEvent(new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true}));window.__copied=data.getData('text/html');return !!window.__copied;};});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WORKSPACE_URL||'http://127.0.0.1:3003');
 await page.locator('.tiptap').waitFor();
 await page.locator('input[type=file][accept=".md,.markdown,.txt,.html,.htm,.docx"]').setInputFiles({name:'风格验收.md',mimeType:'text/markdown',buffer:Buffer.from('# 排版验收\n\n## 从小事开始\n\n正文保留判断。\n\n> 引用保留原文。\n\n| 场景 | 结论 |\n| --- | --- |\n| 阅读 | 可用 |\n\n![照片](https://mmbiz.qpic.cn/mmbiz_png/fixture/0)')});
 await page.locator('.v091-wechat-article h1').filter({hasText:'排版验收'}).waitFor();
 await page.locator('button[data-tab=layout]').click();await page.locator('#toggleAllStyles').click();
 await page.locator('.advanced-settings > summary').click();await page.locator('#paperTextureUrl').fill('https://mmbiz.qpic.cn/mmbiz_png/texture/0');await page.locator('.advanced-settings > summary').click();
 const cards=page.locator('.quick-style-card');assert.equal(await cards.count(),12);const checked=[];
 for(let i=0;i<12;i++){
 const card=cards.nth(i),id=await card.getAttribute('data-v080-style');await card.click();await page.locator('.v091-preview.style-'+id).waitFor();assert.equal(await card.getAttribute('aria-pressed'),'true');
 const html=await page.locator('.v091-wechat-article').innerHTML();assert.ok(html.includes('引用保留原文'));assert.ok(html.includes('https://mmbiz.qpic.cn/mmbiz_png/fixture/0'));assert.ok(html.includes('阅读'));
 if(id==='boldneo')assert.ok(html.includes('rotate(1deg)'));
 if(id==='pixelpost'){assert.ok(html.includes('//'));assert.ok(html.includes('#dfa0bd'));}
 await page.getByRole('button',{name:'⧉ 复制公众号'}).click();const copied=await page.evaluate(()=>window.__copied);assert.ok(copied.includes('排版验收'));assert.equal(await page.evaluate(html=>{const t=document.createElement('div');t.innerHTML=html;return t.innerHTML},copied),html,'Copied HTML must exactly match preview');checked.push(id);
 }
 await page.locator('[data-v080-style=knowledge]').click();await page.locator('.advanced-settings > summary').click();
 await page.locator('#paperTextureUrl').fill('https://example.com/wechat-paper.jpg');await page.waitForFunction(()=>document.querySelector('.v091-wechat-article').innerHTML.includes('https://example.com/wechat-paper.jpg'));
 await page.locator('#fontSize').focus();await page.locator('#fontSize').press('ArrowRight');await page.locator('#fontSize').press('ArrowRight');await page.waitForFunction(()=>document.querySelector('#fontSize').value==='18');
 const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'↓ 导出 HTML'}).click();const download=await downloadEvent;const exported=fs.readFileSync(await download.path(),'utf8');assert.ok(exported.includes('https://example.com/wechat-paper.jpg'));assert.ok(exported.includes('font-size:18px'));
 await page.waitForTimeout(1500);await page.reload();await page.locator('.tiptap').waitFor();await page.waitForFunction(()=>document.querySelector('.v091-wechat-article')?.innerHTML.includes('https://example.com/wechat-paper.jpg'));assert.ok((await page.locator('.v091-wechat-article').innerHTML()).includes('font-size:18px'));
 assert.deepEqual(errors,[]);const out=path.resolve(__dirname,'../docs/validation/style-replacement/workspace-report.json');fs.writeFileSync(out,JSON.stringify({production:true,styles:checked,copyMatchesPreview:true,htmlExport:true,textureAndAppearanceSurviveReload:true,pageErrors:errors},null,2));console.log('PASS: production style selection, original images, exact rich copy, HTML export, texture settings and reload persistence');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
