/** UI integration with fixture AI responses. No real credentials or supplier calls. */
const { chromium } = require(require.resolve('playwright', { paths: [process.argv[2] || process.cwd()] }));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.WORKSPACE_URL || 'http://127.0.0.1:3105';
const out = path.resolve(process.env.VALIDATION_OUTPUT || 'docs/validation/optimization-20261025');
const mockCoverCatalog = process.env.MOCK_COVER_CATALOG === '1';
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { mockProvider: true, mockCoverCatalog, checks: [], pageErrors: [] };
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
    page = await context.newPage(); page.on('pageerror', error => report.pageErrors.push(error.message));
    await page.goto(`${base}/favicon.svg`);
    await page.evaluate(() => {
      localStorage.setItem('kaipai.community.api-profiles.v4', JSON.stringify({ profiles: [{ id: 'fixture', name: '验收模拟连接', provider: 'Custom', baseUrl: 'https://fixture.invalid/v1', apiKey: 'kpcred1.fixture-only', models: { text: 'fixture-text', image: 'fixture-image' }, adapters: { text: 'openai-chat', image: 'openai-images' }, modelConfigs: [{ id: 'text', modelId: 'fixture-text', displayName: '验收文字模型', capabilities: ['text', 'vision'], adapter: 'openai-chat', enabled: true }, { id: 'image', modelId: 'fixture-image', displayName: '验收图片模型', capabilities: ['image-generation'], adapter: 'openai-images', enabled: true }] }], roles: { textId: 'fixture', textModelId: 'text', imageId: 'fixture', imageModelId: 'image' } }));
    });
    let releaseCover;
    const coverGate = new Promise(resolve => { releaseCover = resolve; });
    if (mockCoverCatalog) await page.route('**/api/ai/design?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, version: 'fixture', styles: [{ id: 'fixture-cover', name: '验收封面风格', description: '仅用于交互验收' }] }) }));
    await page.route('**/api/ai', async route => {
      const body = route.request().postDataJSON(); let result;
      if (body.operation === 'design-recommend') {
        await coverGate;
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: '{"recommendations":[]}', model: 'fixture' }) }).catch(() => {});
        return;
      }
      if (body.operation === 'layout' || body.operation === 'full') result = { style: 'v4-editorial', summary: '保留原文，突出关键句。', keep: [], suggestions: [{ id: 'highlight-1', kind: 'emphasis', anchor: { quote: '这是需要保留的正文。' }, proposal: null, presentation: 'highlight', reason: '突出本段重点', depends_on: [], conflicts_with: [] }] };
      else if (body.operation === 'review') result = { suggestions: [{ kind: 'replace', quote: '这是需要保留的正文。', replacement: '这是需要完整保留的正文。', reason: '明确保留范围' }] };
      else result = { titles: ['经过验收的文章标题', '第二个标题', '第三个标题'] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: JSON.stringify(result), model: 'fixture' }) });
    });
    await context.route('https://fixture.invalid/**', route => route.abort());
    await page.goto(base); await page.locator('.tiptap').waitFor();
    // Production loads saved profiles asynchronously; don't click AI before restoration finishes.
    await page.locator('.v091-api-status.connected').waitFor();
    await page.locator('input[accept=".md,.markdown,.txt,.html,.htm,.docx"]').setInputFiles({ name: 'AI验收.md', mimeType: 'text/markdown', buffer: Buffer.from('# AI验收标题\n\n这是需要保留的正文。') });
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('AI验收标题'));
    await page.locator('[data-tab="ai"]').click();
    await page.getByRole('button', { name: '✦ 生成排版方案', exact: true }).click();
    await page.getByText('建议版尚未应用', { exact: true }).waitFor();
    assert.ok(!(await page.locator('.v091-legacy-source').inputValue()).includes('=='));
    await page.getByRole('button', { name: /应用所选建议与风格/ }).click();
    await page.waitForFunction(() => document.querySelector('.v091-legacy-source')?.value.includes('==这是需要保留的正文。=='));
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.v091-legacy-source')?.value.includes('=='));
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.v091-legacy-source')?.value.includes('=='));
    report.checks.push('layout preview leaves source unchanged; adoption, undo and redo preserve content');

    await page.getByRole('button', { name: '优化标题', exact: true }).click();
    const revision = page.getByRole('dialog', { name: '标题建议对照' }); await revision.waitFor();
    await revision.getByRole('button', { name: '应用到文章', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.tiptap h1')?.textContent === '经过验收的文章标题');
    report.checks.push('title comparison dialog and explicit application');

    await page.getByRole('button', { name: 'AI 检查文章', exact: true }).click();
    await page.locator('.article-review-mark').first().click();
    await page.getByRole('dialog', { name: '文章建议' }).getByRole('button', { name: '采用', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('这是需要完整保留的正文。'));
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.tiptap')?.textContent.includes('这是需要保留的正文。'));
    report.checks.push('inline article review adoption and undo');

    await page.getByRole('button', { name: '封面与配图', exact: true }).click();
    await page.getByRole('button', { name: '有字封面', exact: true }).click();
    const recommend = page.getByRole('button', { name: '根据文章推荐三种', exact: true });
    const requestEvent = page.waitForRequest(request => request.url().endsWith('/api/ai') && request.postDataJSON()?.operation === 'design-recommend').catch(error => ({ error }));
    await recommend.click(); const request = await requestEvent;
    if (request.error) throw request.error;
    await page.locator('[data-tab="layout"]').click();
    releaseCover();
    await page.waitForTimeout(300);
    await page.locator('[data-tab="ai"]').click();
    assert.equal(await page.getByRole('button', { name: '停止', exact: true }).count(), 0);
    assert.ok(request.failure()?.errorText?.includes('ERR_ABORTED'), 'leaving cover panel must abort the actual browser request');
    assert.equal(await page.getByRole('button', { name: '有字封面', exact: true }).getAttribute('aria-pressed'), 'true');
    report.checks.push('leaving AI tab aborts cover request and retains form choice');
    await page.screenshot({ path: path.join(out, 'ai.png') });
    assert.deepEqual(report.pageErrors, []);
    fs.writeFileSync(path.join(out, 'ai-browser-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    report.failure = String(error);
    report.debug = await page?.locator('body').innerText().catch(() => '');
    await page?.screenshot({ path: path.join(out, 'ai-failure.png') }).catch(() => {});
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'ai-browser-report.json'), JSON.stringify(report, null, 2)); throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
