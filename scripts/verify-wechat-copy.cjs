/** Own-site production fixture. Website copy keeps original HTML; plugin upload is tested separately. */
const { chromium } = require(require.resolve('playwright', { paths: [process.argv[2] || process.cwd()] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WORKSPACE_URL || 'http://127.0.0.1:8796';
const out = path.resolve(process.env.VALIDATION_OUTPUT || 'docs/validation/wechat-copy-plugin-20261028/copy');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7sAAAAASUVORK5CYII=';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { checks: [], pageErrors: [], articleStorageRequests: [], wechatEditorTested: false };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('request', request => { if (request.url().includes('/api/article-assets')) report.articleStorageRequests.push(request.url()); });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { write: async items => { window.__copiedHtml = await (await items[0].getType('text/html')).text(); window.__copies = (window.__copies || 0) + 1; } } });
    });
    await page.goto(base); await page.locator('.tiptap').waitFor();
    const input = page.locator('input[accept=".md,.markdown,.txt,.html,.htm,.docx"]');
    await input.setInputFiles({ name: '复制验收.md', mimeType: 'text/markdown', buffer: Buffer.from(`# 图文复制验收\n\n:::lead\n![封面 | 顶部组件图](${png})\n正文与**半荧光重点**。\n:::\n\n![正文图](${png})`) });
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('图文复制验收'));
    await page.waitForFunction(() => document.querySelectorAll('.v091-wechat-article img').length === 2);
    const original = await page.locator('.v091-legacy-source').inputValue();
    await page.getByRole('button', { name: '⧉ 复制公众号', exact: true }).click();
    await page.waitForFunction(() => window.__copiedHtml?.includes('顶部组件图'));
    const html = await page.evaluate(() => window.__copiedHtml);
    assert.equal((html.match(/<img\b/g) || []).length, 2);
    assert.ok(html.includes(png) && !html.includes('待上传'));
    assert.equal(await page.getByRole('dialog', { name: '准备图文复制' }).count(), 0);
    assert.equal(await page.locator('.v091-legacy-source').inputValue(), original);
    assert.deepEqual(report.articleStorageRequests, []);
    report.checks.push('top/component and body images copied directly with captions and original sources; original article unchanged; no old modal or storage requests');
    await page.getByRole('button', { name: '⧉ 复制公众号', exact: true }).click();
    await page.waitForFunction(() => window.__copies === 2);
    await page.screenshot({ path: path.join(out, 'direct-copy.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(report.pageErrors, []);
    report.checks.push('repeat copy and narrow screen pass without page errors');
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
