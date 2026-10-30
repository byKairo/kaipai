/** Fresh browser storage only. No real images, profiles, supplier calls or user data. */
const { chromium } = require(require.resolve('playwright', { paths: [process.argv[2] || process.cwd()] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WORKSPACE_URL || 'http://127.0.0.1:8788';
const out = path.resolve(process.env.VALIDATION_OUTPUT || 'docs/validation/image-history-20261026/workers');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7sAAAAASUVORK5CYII=';
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { url: base, checks: [], pageErrors: [], realSupplierCalled: false };
  let page;
  const makeContext = async count => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
    await context.addInitScript(() => {
      const original = IDBObjectStore.prototype.get;
      window.__imageReads = 0;
      IDBObjectStore.prototype.get = function(...args) {
        const imageStore = this.transaction.db.name === 'kaipai-generated-images';
        if (imageStore) window.__imageReads++;
        const request = original.apply(this, args);
        if (imageStore && window.__failImageRead) { window.__failImageRead = false; this.transaction.abort(); }
        return request;
      };
    });
    const tab = await context.newPage();
    tab.on('pageerror', error => report.pageErrors.push(error.message));
    await tab.goto(`${base}/favicon.svg`);
    await tab.evaluate(async ({ count, png }) => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('kaipai-generated-images', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        for (let i = 0; i < count; i++) tx.objectStore('images').put({ id: `historic-${String(i).padStart(2, '0')}`, src: png, brief: `历史${i % 2 ? '配图' : '封面'}${i}`, prompt: '验收画面', createdAt: 100,
          ...(i % 2 ? {} : { cover: { review: { status: 'passed' } } }) });
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      }); db.close();
    }, { count, png });
    await tab.goto(base); await tab.locator('.tiptap').waitFor();
    await tab.locator('input[accept=".md,.markdown,.txt,.html,.htm,.docx"]').setInputFiles({ name: '历史图片验收.md', mimeType: 'text/markdown', buffer: Buffer.from('# 历史图片验收\n\n保留正文。') });
    await tab.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('历史图片验收'));
    await tab.locator('[data-tab="ai"]').click();
    await tab.getByRole('button', { name: '封面与配图', exact: true }).click();
    await tab.getByText(/历史封面与配图 · 已加载/).click();
    return { context, page: tab };
  };
  try {
    const first = await makeContext(25); page = first.page;
    const cards = page.locator('[data-saved-image-id]');
    await page.waitForFunction(() => document.querySelectorAll('[data-saved-image-id]').length === 12);
    assert.equal(await page.evaluate(() => window.__imageReads), 12);
    assert.deepEqual(await cards.evaluateAll(items => items.map(item => item.dataset.savedImageId)), Array.from({ length: 12 }, (_, i) => `historic-${24 - i}`));
    report.checks.push('v1 migration, equal timestamps, initial page reads exactly 12 originals');

    await page.evaluate(() => { window.__failImageRead = true; });
    await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: '图片加载失败' }).waitFor();
    assert.equal(await cards.count(), 12);
    const beforeRetry = await page.evaluate(() => window.__imageReads);
    await page.getByRole('button', { name: '重试加载', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-saved-image-id]').length === 24);
    assert.equal(await page.evaluate(() => window.__imageReads), beforeRetry + 12);
    report.checks.push('failed pagination preserves pictures; retry reads only the next 12');
    await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).click();
    await page.getByText('已显示全部历史图片', { exact: true }).waitFor();
    assert.equal(await cards.count(), 25);
    assert.equal(new Set(await cards.evaluateAll(items => items.map(item => item.dataset.savedImageId))).size, 25);
    assert.equal(await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).count(), 0);
    report.checks.push('last page and complete archive have no duplicates or omissions');

    const oldestCover = page.locator('[data-saved-image-id="historic-00"]');
    await oldestCover.getByRole('button', { name: '查看历史封面0', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '历史图片大图' }); await dialog.waitFor();
    assert.equal(await dialog.locator('img').getAttribute('src'), png);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
    for (const id of ['historic-00', 'historic-01']) {
      const card = page.locator(`[data-saved-image-id="${id}"]`);
      const event = page.waitForEvent('download'); await card.getByRole('link', { name: '下载', exact: true }).click();
      const download = await event;
      assert.ok(download.suggestedFilename().includes(id));
      assert.deepEqual(fs.readFileSync(await download.path()), Buffer.from(png.split(',')[1], 'base64'));
      await card.getByRole('button', { name: '插入正文', exact: true }).click();
    }
    await page.waitForFunction(() => document.querySelectorAll('.tiptap img').length === 2);
    const exportEvent = page.waitForEvent('download'); await page.getByRole('button', { name: '↓ 导出 Markdown', exact: true }).click();
    const exported = fs.readFileSync(await (await exportEvent).path(), 'utf8');
    assert.ok(exported.includes('历史封面0') && exported.includes('历史配图1') && exported.includes(png));
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    // The editor may group rapid adjacent insertions into one undo step.
    await page.waitForFunction(() => document.querySelectorAll('.tiptap img').length < 2);
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.tiptap img').length === 2);
    report.checks.push('old cover and illustration preview/download/reuse preserve original bytes; insertion supports export and undo/redo');

    await page.locator('[data-saved-image-id="historic-01"]').getByRole('button', { name: '继续编辑画面要求', exact: true }).click();
    const reused = page.getByRole('article', { name: '第 1 张配图', exact: true });
    await reused.waitFor();
    await reused.getByText('调整画面与重新生成', { exact: true }).click();
    assert.equal(await reused.getByRole('textbox', { name: '画面要求', exact: true }).inputValue(), '验收画面');
    assert.equal(await reused.locator('img').getAttribute('src'), png);
    report.checks.push('legacy saved-image editing and regeneration controls remain available');

    await page.getByRole('button', { name: '当前段落', exact: true }).click();
    assert.equal(await cards.count(), 25);
    await page.locator('[data-tab="layout"]').click(); await page.locator('[data-tab="ai"]').click();
    assert.equal(await cards.count(), 25);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('navigation', { name: '移动端面板切换' }).getByRole('button', { name: '样式', exact: true }).click();
    await cards.last().waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await cards.first().scrollIntoViewIfNeeded();
    await page.locator('.v091-toast').waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
    report.checks.push('cover/paragraph and outer tabs retain expanded history; 390px has no overflow');
    await page.reload();
    await page.getByRole('navigation', { name: '移动端面板切换' }).getByRole('button', { name: '样式', exact: true }).click();
    await page.locator('[data-tab="ai"]').click(); await page.getByRole('button', { name: '封面与配图', exact: true }).click();
    await page.getByText(/历史封面与配图 · 已加载/).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-saved-image-id]').length === 12);
    assert.equal(await page.evaluate(() => window.__imageReads), 12);
    await first.context.close();
    report.checks.push('reload returns to a 12-record first page without deleting archived images');
    for (const count of [24, 0]) {
      const fixture = await makeContext(count); page = fixture.page;
      if (count) {
        await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).click();
        await page.getByText('已显示全部历史图片', { exact: true }).waitFor();
        assert.equal(await page.locator('[data-saved-image-id]').count(), 24);
      } else await page.getByText('还没有保存的图片', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).count(), 0);
      await fixture.context.close();
    }
    report.checks.push('exactly 24 images and empty library have correct end states');
    assert.deepEqual(report.pageErrors, []);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.failure = String(error);
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
      report.debug = await page.locator('body').innerText().catch(() => '');
    }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
