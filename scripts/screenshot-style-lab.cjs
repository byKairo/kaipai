const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const out=path.resolve(__dirname,'../public/style-lab');
async function main(){
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:720,height:460},deviceScaleFactor:1});
  for(const id of ['screen-sample','reading-model','route-sample']){
   await page.goto(pathToFileURL(path.join(out,'assets',id+'.html')).href);
   await page.evaluate(()=>document.fonts.ready);
   await page.screenshot({path:path.join(out,'assets',id+'.png'),fullPage:true});
  }
  const report=JSON.parse(fs.readFileSync(path.join(out,'validation.json'),'utf8'));
  const checks=[];
  await page.setViewportSize({width:1260,height:1100});
  for(let n=1;n<=4;n++){
   await page.goto(pathToFileURL(path.join(out,`batch-${n}.html`)).href);
   await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
   await page.screenshot({path:path.join(out,`batch-${n}.png`),fullPage:true,scale:'css'});
  }
  for(let n=1;n<=2;n++){
   await page.goto(pathToFileURL(path.join(out,`reference-update-${n}.html`)).href);
   await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
   await page.screenshot({path:path.join(out,`reference-update-${n}.png`),fullPage:true,scale:'css'});
  }
  for(const style of report.styles){
   for(const width of [320,390,430]){
    await page.setViewportSize({width,height:1000});
    await page.goto(pathToFileURL(path.join(out,style.id+'-preview.html')).href);
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
    await page.evaluate(()=>document.fonts.ready);
    const check=await page.evaluate(()=>({viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('section,p,td,th,table,img,span')].filter(el=>{const r=el.getBoundingClientRect();return r.left < -1 || r.right > innerWidth+1}).map(el=>el.tagName),imageSizes:[...document.images].map(i=>({actual:i.naturalWidth,declared:Number(i.dataset.w)}))}));
    if(check.scrollWidth>width||check.outside.length)throw Error(JSON.stringify({id:style.id,width,check}));
    if(style.id==='brand'){
     const aligned=await page.evaluate(()=>{const cards=[...document.querySelectorAll('section[style*="width:31%"]')];return cards.length===3&&cards.every(el=>Math.abs(el.getBoundingClientRect().top-cards[0].getBoundingClientRect().top)<1);});
     if(!aligned)throw Error('Brand information cards wrapped at '+width);
    }
    if(check.imageSizes.some(i=>i.actual!==i.declared))throw Error('Incorrect data-w '+style.id+JSON.stringify(check.imageSizes));
    checks.push({id:style.id,width,overflow:false});
    if(width===390)await page.locator('body > section').screenshot({path:path.join(out,style.id+'.png')});
    if(style.fontFallback){
     await page.evaluate(()=>document.querySelectorAll('[style]').forEach(el=>el.style.removeProperty('font-family')));
     if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Font fallback overflow '+style.id);
     checks[checks.length-1].fontFallbackPassed=true;
    }
   }
  }
  for(const id of ['polaroid','film','archive','caption-rail']){
   for(const width of [320,390,430]){
    await page.setViewportSize({width,height:1000});
    await page.goto(pathToFileURL(path.join(out,'image-'+id+'.html')).href);
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Image frame overflow '+id);
    checks.push({imageMode:id,width,overflow:false});
    if(width===390)await page.locator('body > section').screenshot({path:path.join(out,'image-'+id+'.png')});
   }
  }
  await page.setViewportSize({width:900,height:1000});
  await page.goto(pathToFileURL(path.join(out,'image-lab.html')).href);
  await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
  await page.screenshot({path:path.join(out,'image-lab.png'),fullPage:true});
  report.browserChecks=checks;report.platformVerified=false;
  fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));
  console.log('Rendered 12 full articles, 4 batches, 4 image modes. All 48 width checks passed; relevant font fallbacks passed.');
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1});
