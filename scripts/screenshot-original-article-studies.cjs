const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const out=path.resolve(__dirname,'../public/original-article-studies');
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:1000},deviceScaleFactor:2});
  const report=JSON.parse(fs.readFileSync(path.join(out,'validation.json'),'utf8'));
  const checks=[];
  for(const id of ['paper','tilted']){
   for(const width of [320,390,430]){
    await page.setViewportSize({width,height:1000});
    await page.goto(pathToFileURL(path.join(out,id+'.html')).href);
    await page.evaluate(()=>document.fonts.ready);
    const state=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('section,p,td,table')].map(el=>el.getBoundingClientRect()).filter(r=>r.left< -1||r.right>innerWidth+1).length}));
    if(state.scrollWidth>width||state.outside)throw Error(JSON.stringify({id,width,state}));
    checks.push({id,width,overflow:false});
    if(width===390)await page.locator('body > section').screenshot({path:path.join(out,id+'.png')});
   }
  }
  report.browserChecks=checks;report.platformVerified=false;
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));
  console.log('Six mobile-width checks passed; real article screenshots exported. Platform verification pending.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
