/** Fresh browser, no user profile. Measures fetched startup assets, not a latency benchmark. */
const { chromium } = require(require.resolve('playwright', { paths: [process.argv[2] || process.cwd()] }));
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.WORKSPACE_URL || 'https://kaipai.kairostudio.workers.dev';
async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url); await page.locator('.tiptap').waitFor();
    await page.waitForLoadState('networkidle');
    const assets = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(entry => /\.(js|css)(\?|$)/.test(entry.name))
      .map(entry => ({ path: new URL(entry.name).pathname, encoded: entry.encodedBodySize, decoded: entry.decodedBodySize })));
    const total = suffix => assets.filter(a => a.path.endsWith(suffix)).reduce((out, a) => ({ files: out.files + 1, encoded: out.encoded + a.encoded, decoded: out.decoded + a.decoded }), { files: 0, encoded: 0, decoded: 0 });
    const report = { url, measuredAt: new Date().toISOString(), js: total('.js'), css: total('.css'), assets };
    const file = path.resolve(process.env.ASSET_REPORT || 'docs/validation/optimization-release-20261026/assets-before.json');
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ js: report.js, css: report.css, file }, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
