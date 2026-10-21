const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const version=process.argv[2] || 'v2';
if(!['v2','v3'].includes(version))throw Error('Unknown proposal version');
const root = path.resolve(__dirname, `../public/style-proposals-${version}`);
async function main() {
 const browser = await chromium.launch({channel:'chrome',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:version==='v3'?1260:1248,height:1100},deviceScaleFactor:2});
  const failures=[];
  for(let g=1;g<=4;g++) {
   await page.goto(pathToFileURL(path.join(root,`sheet-${g}.html`)).href);
   await page.screenshot({path:path.join(root,`sheet-${g}.png`),fullPage:true});
  }
  const styles=JSON.parse(fs.readFileSync(path.join(root,'validation.json'),'utf8'));
  for(const s of styles.styles) {
   for(const width of [320,390,430]) {
    await page.setViewportSize({width,height:1000});
    await page.goto(pathToFileURL(path.join(root,`${s.id}-preview.html`)).href);
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
    const measurement=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('section,p,table,td,th,span')].filter(el=>{const r=el.getBoundingClientRect();return r.right>innerWidth+1||r.left< -1}).map(el=>el.tagName)}));
    if(measurement.content>width || measurement.overflow.length)failures.push({id:s.id,width,measurement});
    if(width===390)await page.screenshot({path:path.join(root,`${s.id}.png`),fullPage:true});
    if(s.fontFallback) {
     await page.evaluate(()=>{document.querySelectorAll('[style]').forEach(el=>el.style.removeProperty('font-family'));});
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
     if(overflow)failures.push({id:s.id,width,fontFallback:true});
     if(width===390)await page.screenshot({path:path.join(root,`${s.id}-font-fallback.png`),fullPage:true});
    }
   }
  }
  styles.browser={engine:'Chrome headless',widths:[320,390,430],overflowFailures:failures};
  fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(styles,null,2));
  if(failures.length)throw new Error(JSON.stringify(failures));
  console.log('Rendered 4 sheets and 12 article images. All 36 mobile width checks passed.');
 } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1});
