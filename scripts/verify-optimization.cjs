/** Production browser regression in fresh contexts; never touches the user's browser profile. */
const { chromium } = require(require.resolve('playwright', { paths: [process.argv[2] || process.cwd()] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WORKSPACE_URL || 'http://127.0.0.1:3105';
const output = path.resolve(process.env.VALIDATION_OUTPUT || 'docs/validation/optimization-20261025');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7sAAAAASUVORK5CYII=';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = `# 优化验收文章\n\n## 保留全部内容\n\n这是需要保留的正文。\n\n> 引用保留原意。\n\n| 项目 | 数值 |\n| --- | --- |\n| 表格保留 | 42 |\n\n\`\`\`js\nconst value = 42;\n\`\`\`\n\n![原图说明](${png})`;
async function importMarkdown(page, markdown, name = '验收.md') {
  await page.locator('input[accept=".md,.markdown,.txt,.html,.htm,.docx"]').setInputFiles({ name, mimeType: 'text/markdown', buffer: Buffer.from(markdown) });
  await page.waitForFunction(title => document.querySelector('.tiptap')?.textContent.includes(title), markdown.split('\n')[0].replace(/^#+\s*/, ''));
  await page.waitForFunction(title => document.querySelector('.v091-wechat-article')?.textContent.includes(title), markdown.split('\n')[0].replace(/^#+\s*/, ''));
}
async function download(page, name) {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const file = await event;
  return fs.readFileSync(await file.path());
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { production: true, checks: [], pageErrors: [] };
  async function context(options = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true, ...options });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { write: async items => { window.__copiedHtml = await (await items[0].getType('text/html')).text(); } } });
    });
    ctx.on('page', page => page.on('pageerror', error => report.pageErrors.push(error.message)));
    return ctx;
  }
  try {
    const ctx = await context();
    const page = await ctx.newPage();
    await page.goto(`${base}/favicon.svg`);
    await page.evaluate(async png => {
      const open = (name, version, upgrade) => new Promise((resolve, reject) => { const r = indexedDB.open(name, version); r.onupgradeneeded = () => upgrade(r.result); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
      const db = await open('kaipai-community', 4, db => { db.createObjectStore('articles', { keyPath: 'id' }); db.createObjectStore('drafts', { keyPath: 'id' }); });
      await new Promise((resolve, reject) => { const tx = db.transaction('articles', 'readwrite'); for (const [id, text] of [['old-a', '旧稿甲'], ['old-b', '旧稿乙']]) tx.objectStore('articles').put({ id, title: text, markdown: text, content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, style: 'knowledge', createdAt: 1, updatedAt: 2 }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close(); localStorage.setItem('kaipai.activeArticle', 'old-a');
      const images = await open('kaipai-generated-images', 1, db => db.createObjectStore('images', { keyPath: 'id' }));
      await new Promise((resolve, reject) => { const tx = images.transaction('images', 'readwrite'); for (let i = 0; i < 100; i++) tx.objectStore('images').put({ id: `old-image-${i}`, src: png, brief: `旧图片${i}`, prompt: 'fixture', createdAt: i }); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); images.close();
    }, png);
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent === '旧稿甲');
    await page.locator('[data-tab="drafts"]').click();
    await page.locator('[data-draft-open="old-b"]').click();
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent === '旧稿乙');
    const migrated = await page.evaluate(async () => {
      const db = await new Promise(resolve => { const r = indexedDB.open('kaipai-community'); r.onsuccess = () => resolve(r.result); });
      const summaries = await new Promise(resolve => { const r = db.transaction('article-summaries').objectStore('article-summaries').getAll(); r.onsuccess = () => resolve(r.result); }); const version = db.version; db.close();
      const images = await new Promise(resolve => { const r = indexedDB.open('kaipai-generated-images'); r.onsuccess = () => resolve(r.result); });
      const count = await new Promise(resolve => { const r = images.transaction('images').objectStore('images').count(); r.onsuccess = () => resolve(r.result); }); const imageVersion = images.version; images.close(); return { version, imageVersion, count, summaries };
    });
    assert.equal(migrated.version, 5); assert.equal(migrated.imageVersion, 2); assert.equal(migrated.count, 100);
    assert.ok(migrated.summaries.every(item => !('content' in item) && !('markdown' in item)));
    report.checks.push('v4 article/v1 image migration, old draft switching, all 100 originals retained');

    await importMarkdown(page, fixture);
    const original = await page.locator('.v091-legacy-source').inputValue();
    await page.locator('[data-tab="layout"]').click(); await page.locator('#toggleAllStyles').click();
    const cards = page.locator('.quick-style-card'); assert.equal(await cards.count(), 12);
    for (let i = 0; i < 12; i++) {
      const card = cards.nth(i), id = await card.getAttribute('data-v080-style'); await card.click();
      await page.locator(`.v091-preview.style-${id}[aria-busy="false"]`).waitFor();
      assert.equal(await page.locator('.v091-legacy-source').inputValue(), original);
      const html = await page.locator('.v091-wechat-article').innerHTML();
      for (const text of ['优化验收文章', '引用保留原意', '表格保留', 'const value', '原图说明']) assert.ok(html.includes(text), `${id}: ${text}`);
    }
    report.checks.push('all 12 styles preserve text, table, code, image and caption');
    await page.getByRole('button', { name: '⧉ 复制公众号', exact: true }).click();
    await page.waitForFunction(() => window.__copiedHtml?.includes('原图说明'));
    assert.equal(await page.getByRole('dialog', { name: '准备图文复制' }).count(), 0);
    assert.ok((await page.evaluate(() => window.__copiedHtml)).includes('<img'));
    assert.ok((await download(page, '↓ 导出 HTML')).toString().includes('原图说明'));
    const zip = await download(page, '↓ 下载图片'); assert.equal(zip.subarray(0, 2).toString(), 'PK');
    report.checks.push('direct styled copy preserves images without old storage modal; HTML export and optional image package still work');

    await page.locator('.tiptap').click(); await page.locator('.tiptap').press('ControlOrMeta+End');
    await page.keyboard.insertText('立即导出标记');
    assert.ok((await download(page, '↓ 导出 HTML')).toString().includes('立即导出标记'), 'export must use latest text, even before deferred preview');
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.tiptap')?.textContent.includes('立即导出标记'));
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('立即导出标记'));
    await page.locator('[data-tab="styles"]').click(); await page.locator('[data-insert="lead"]').click();
    await page.locator('.tiptap [data-kaipai-component="lead"]').waitFor();
    const beforeReload = await page.locator('.v091-legacy-source').inputValue();
    await wait(900); await page.reload(); await page.waitForFunction(text => document.querySelector('.v091-legacy-source')?.value === text, beforeReload);
    report.checks.push('immediate export, undo/redo, component insertion and reload recovery');

    const long = '# 长文验收\n\n' + '这是一段保留顺序的长文，包含**重点**与普通文字。\n\n'.repeat(1200);
    await importMarkdown(page, long, '长文.md');
    await page.locator('.tiptap').click(); await page.locator('.tiptap').press('ControlOrMeta+End');
    await page.keyboard.type('END-1234567890');
    const exportedMarkdown = (await download(page, '↓ 导出 Markdown')).toString();
    assert.equal(exportedMarkdown, await page.locator('.v091-legacy-source').inputValue());
    assert.ok(exportedMarkdown.includes('END-1234567890'), exportedMarkdown.slice(-160));
    await page.waitForFunction(() => document.querySelector('.v091-wechat-article')?.textContent.includes('END-1234567890'));
    report.checks.push('long article typing and latest Markdown export');
    await page.setViewportSize({ width: 390, height: 844 });
    for (const label of ['样式', '编辑', '预览']) await page.getByRole('navigation', { name: '移动端面板切换' }).getByRole('button', { name: label, exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.screenshot({ path: path.join(output, 'mobile.png') });
    report.checks.push('390px mobile panel switches and no page overflow');
    await ctx.close();

    const fallbackContext = await context();
    await fallbackContext.addInitScript(() => Object.defineProperty(window, 'indexedDB', { configurable: true, value: undefined }));
    const fallback = await fallbackContext.newPage(); await fallback.goto(base); await fallback.locator('.tiptap').waitFor();
    await importMarkdown(fallback, '# 降级文稿甲\n\n甲的独立内容'); await wait(900);
    await importMarkdown(fallback, '# 降级文稿乙\n\n乙的独立内容'); await wait(900);
    await fallback.reload(); await fallback.locator('.tiptap').waitFor(); await fallback.locator('[data-tab="drafts"]').click();
    assert.equal(await fallback.locator('.draft-open').filter({ hasText: '降级文稿' }).count(), 2);
    await fallback.locator('.draft-open').filter({ hasText: '降级文稿甲' }).click();
    await fallback.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('甲的独立内容'));
    report.checks.push('IndexedDB unavailable: two fallback documents both survive reload and reopening');
    await fallbackContext.close();

    const restrictedContext = await context();
    await restrictedContext.addInitScript(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('kaipai.community.')) throw new DOMException('Quota exceeded', 'QuotaExceededError'); return set.call(this, key, value); }; });
    const restricted = await restrictedContext.newPage(); await restricted.goto(base); await restricted.locator('.tiptap').waitFor();
    await importMarkdown(restricted, '# 空间不足仍可编辑\n\n保留正文'); await wait(400);
    await restricted.locator('.quick-style-card:visible').first().click();
    assert.ok((await download(restricted, '↓ 导出 HTML')).toString().includes('空间不足仍可编辑'));
    report.checks.push('settings storage quota failure keeps editor and export available');
    await restrictedContext.close();
    assert.deepEqual(report.pageErrors, []);
    fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.debug = [];
    for (const ctx of browser.contexts()) for (const page of ctx.pages()) {
      report.debug.push(await page.evaluate(() => ({ url: location.href, editor: document.querySelector('.tiptap')?.textContent?.slice(0, 200), preview: document.querySelector('.v091-wechat-article')?.textContent?.slice(0, 200), body: document.body.innerText.slice(-600) })).catch(() => ({})));
      await page.screenshot({ path: path.join(output, `failure-${report.debug.length}.png`) }).catch(() => {});
    }
    report.failure = String(error); fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2)); throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
