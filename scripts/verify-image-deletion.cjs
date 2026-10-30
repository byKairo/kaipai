/** Disposable browser fixtures only; never deletes images from the user's browser profile. */
const { chromium } = require(require.resolve('playwright', { paths: [process.argv[2] || process.cwd()] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WORKSPACE_URL || 'http://127.0.0.1:8788';
const out = path.resolve(process.env.VALIDATION_OUTPUT || 'docs/validation/image-deletion-20261026/workers');
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7sAAAAASUVORK5CYII=';
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { url: base, checks: [], pageErrors: [], confirmationExample: '', realSupplierCalled: false };
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 }, acceptDownloads: true });
    await context.addInitScript(() => {
      window.__imageReads = 0; window.__imageDeletes = 0;
      const get = IDBObjectStore.prototype.get, remove = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.get = function(...args) {
        if (this.transaction.db.name === 'kaipai-generated-images') window.__imageReads++;
        return get.apply(this, args);
      };
      IDBObjectStore.prototype.delete = function(...args) {
        const imageStore = this.transaction.db.name === 'kaipai-generated-images';
        if (imageStore) window.__imageDeletes++;
        const request = remove.apply(this, args);
        if (imageStore && window.__failImageDelete) { window.__failImageDelete = false; this.transaction.abort(); }
        return request;
      };
    });
    page = await context.newPage(); page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(base + '/favicon.svg');
    await page.evaluate(async png => {
      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open('kaipai-generated-images', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      await new Promise((resolve, reject) => {
        const tx = db.transaction('images', 'readwrite');
        for (let i = 0; i < 25; i++) tx.objectStore('images').put({ id: `delete-${String(i).padStart(2, '0')}`, createdAt: 100, src: png, brief: `验收${i % 2 ? '配图' : '封面'}${i}`, prompt: '保留原始记录', ...(i % 2 ? {} : { cover: { review: { status: 'passed' } } }) });
        tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      }); db.close();
    }, png);
    await page.goto(base); await page.locator('.tiptap').waitFor();
    await page.locator('input[accept=".md,.markdown,.txt,.html,.htm,.docx"]').setInputFiles({ name: '删除验收.md', mimeType: 'text/markdown', buffer: Buffer.from(`# 删除验收\n\n正文保持完整。\n\n![保留在文章中的图片](${png})`) });
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('删除验收') && document.querySelectorAll('.tiptap img').length === 1);
    const cards = page.locator('[data-saved-image-id]');
    async function openHistory(expected) {
      if (page.viewportSize().width < 820) await page.getByRole('navigation', { name: '移动端面板切换' }).getByRole('button', { name: '样式', exact: true }).click();
      await page.locator('[data-tab="ai"]').click(); await page.getByRole('button', { name: '封面与配图', exact: true }).click();
      await page.getByText(/历史封面与配图 · 已加载/).click();
      await page.waitForFunction(count => document.querySelectorAll('[data-saved-image-id]').length === count, expected);
    }
    async function ids() {
      return page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => { const request = indexedDB.open('kaipai-generated-images'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        const keys = await new Promise((resolve, reject) => { const request = db.transaction('images').objectStore('images').getAllKeys(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
        db.close(); return keys;
      });
    }
    async function remove(id, accept) {
      const dialogEvent = page.waitForEvent('dialog');
      const click = page.locator(`[data-saved-image-id="${id}"]`).getByRole('button', { name: '删除', exact: true }).click();
      const dialog = await dialogEvent;
      assert.equal(dialog.type(), 'confirm');
      assert.match(dialog.message(), /删除后无法从历史图片库恢复/);
      assert.match(dialog.message(), /已插入文章的图片和已下载的文件不受影响/);
      if (!report.confirmationExample) report.confirmationExample = dialog.message();
      if (accept) await dialog.accept(); else await dialog.dismiss();
      await click;
    }
    await openHistory(12);
    assert.equal(await page.evaluate(() => window.__imageReads), 12);
    await remove('delete-24', false);
    assert.equal(await page.evaluate(() => window.__imageDeletes), 0);
    assert.equal((await ids()).length, 25); assert.equal(await cards.count(), 12);
    report.checks.push('cancel confirmation performs no database deletion and preserves the cover');

    await page.evaluate(() => { window.__failImageDelete = true; });
    await remove('delete-24', true);
    await page.getByRole('alert').filter({ hasText: '删除未完成' }).waitFor();
    assert.equal((await ids()).length, 25); assert.equal(await cards.count(), 12);
    await remove('delete-24', true);
    await page.locator('[data-saved-image-id="delete-24"]').waitFor({ state: 'detached' });
    assert.equal((await ids()).length, 24); assert.equal(await cards.count(), 11);
    assert.equal(await page.getByRole('alert').filter({ hasText: '删除未完成' }).count(), 0);
    report.checks.push('aborted deletion preserves UI/database; retry commits only the selected cover');

    await remove('delete-13', true);
    await page.locator('[data-saved-image-id="delete-13"]').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.__imageReads), 12, 'deletion does not read or reload any full image');
    await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-saved-image-id]').length === 22);
    assert.equal(await page.evaluate(() => window.__imageReads), 24);
    await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).click();
    await page.getByText('已显示全部历史图片', { exact: true }).waitFor();
    const loaded = await cards.evaluateAll(items => items.map(item => item.dataset.savedImageId));
    assert.equal(loaded.length, 23); assert.equal(new Set(loaded).size, 23);
    assert.deepEqual(loaded.slice().sort(), (await ids()).sort());
    report.checks.push('deleting an equal-timestamp page boundary preserves 12-record pagination without resurrection or omissions');

    assert.equal(await page.locator('.tiptap img').getAttribute('src'), png);
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: '↓ 导出 Markdown', exact: true }).click();
    assert.ok(fs.readFileSync(await (await download).path(), 'utf8').includes(png));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('navigation', { name: '移动端面板切换' }).getByRole('button', { name: '样式', exact: true }).click();
    await remove('delete-23', false);
    await page.locator('[data-saved-image-id="delete-23"]').scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
    report.checks.push('article image and Markdown export survive cleanup; mobile deletion confirmation can be cancelled');

    await page.reload(); await openHistory(12);
    assert.ok(!(await ids()).includes('delete-24') && !(await ids()).includes('delete-13'));
    assert.equal(await page.locator('.tiptap img').getAttribute('src'), png);
    await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).click();
    await page.getByText('已显示全部历史图片', { exact: true }).waitFor();
    assert.equal(await cards.count(), 23);
    const remaining = await cards.evaluateAll(items => items.map(item => item.dataset.savedImageId));
    for (const id of remaining) {
      await remove(id, true);
      await page.locator(`[data-saved-image-id="${id}"]`).waitFor({ state: 'detached' });
    }
    await page.getByText('还没有保存的图片', { exact: true }).waitFor();
    assert.deepEqual(await ids(), []);
    assert.equal(await page.getByRole('button', { name: '加载更多（12 张）', exact: true }).count(), 0);
    await page.reload(); await openHistory(0);
    await page.getByText('还没有保存的图片', { exact: true }).waitFor();
    assert.equal(await page.locator('.tiptap img').getAttribute('src'), png);
    report.checks.push('confirmed deletions persist after reload; clearing the final history item retains the saved article image');
    assert.deepEqual(report.pageErrors, []);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.failure = String(error);
    if (page && !page.isClosed()) { await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); report.debug = await page.locator('body').innerText().catch(() => ''); }
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
