/** Own-code fixture only. Never contacts WeChat or opens a user profile. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(require.resolve('playwright', { paths: [process.argv[2] || process.cwd()] }));
const root = path.resolve('extensions/kaipai-wechat');
const out = path.resolve('docs/validation/wechat-extension-20261028');
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json')));
  assert.deepEqual(manifest.host_permissions, ['https://mp.weixin.qq.com/*']);
  assert.ok(!manifest.permissions.includes('cookies') && !manifest.permissions.includes('tabs'));
  assert.ok(!manifest.externally_connectable && !manifest.content_scripts);
  let actualArticleHtml;
  if (process.env.CAPTURE_ARTICLE_MARKDOWN) {
    const ts = require('typescript');
    require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
    actualArticleHtml = require('../lib/wechat-html.ts').markdownToWechat(fs.readFileSync(process.env.CAPTURE_ARTICLE_MARKDOWN, 'utf8'), '#3155b5', '#fff07a', 'v4-comic');
  }
  const server = http.createServer((req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'prepare.html';
    if (name === 'fixture-login-redirect') { res.writeHead(302, { Location: '/fixture-dashboard' }); res.end(); return; }
    if (name === 'fixture-dashboard') { res.setHeader('Content-Type', 'text/html'); res.end('fixture logged-in dashboard'); return; }
    if (name === 'capture-article.json' && actualArticleHtml) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ html: actualArticleHtml })); return; }
    if (!['prepare.html', 'prepare.css', 'prepare.js', 'core.js', 'clipboard.js', 'handoff.js', 'capture.js', 'transport.js'].includes(name)) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(path.join(root, name)));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const report = { checks: [], actualExtensionInstalled: false, actualWechatTested: false, network: 'local fixture only' };
  const vm = require('node:vm');
  let actionListener, messageListener, createdUrl, records = {}, captures = 0;
  const extensionBase = 'chrome-extension://fixture/';
  const chrome = {
    action: { onClicked: { addListener(fn) { actionListener = fn; } }, setBadgeText: async () => {}, setTitle: async () => {} },
    scripting: { executeScript: async () => { captures++; return [{ result: { html: '<p>新捕获文章</p>', images: [], createdAt: Date.now() } }]; } },
    storage: { session: { get: async () => records, set: async value => { Object.assign(records, value); }, remove: async ids => { for (const id of Array.isArray(ids) ? ids : [ids]) delete records[id]; }, clear: async () => { records = {}; } } },
    tabs: { create: async ({ url }) => { createdUrl = url; }, get: async id => ({ id, url: 'http://127.0.0.1:3004/' }) },
    runtime: { getURL: name => extensionBase + name, onMessage: { addListener(fn) { messageListener = fn; } } }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8').replace(/^import .*;\n/gm, ''), { chrome, URL, TextEncoder, crypto: require('node:crypto').webcrypto, captureArticle() {}, HANDOFF_KEY: 'article-handoff', removeHandoff: async (storage, id) => { await storage.remove(id); const value = (await storage.get('article-handoff'))['article-handoff']; if (value?.id === id) await storage.remove('article-handoff'); } });
  await actionListener({ id: 42, url: 'http://127.0.0.1:3004/' });
  assert.ok(createdUrl.includes('source=42') && createdUrl.includes('#id='));
  let blocked = false;
  messageListener({ type: 'recapture', sourceTab: 42 }, { url: 'https://evil.invalid/prepare.html#id=x' }, () => { blocked = true; });
  assert.equal(blocked, false); assert.equal(captures, 1);
  const recovered = await new Promise(resolve => messageListener({ type: 'recapture', sourceTab: 42 }, { url: createdUrl }, resolve));
  assert.ok(recovered.url.includes('source=42')); assert.equal(captures, 2);
  const storedBeforeFailure = JSON.stringify(records);
  const originalSet = chrome.storage.session.set;
  chrome.storage.session.set = async () => { throw new Error('fixture quota'); };
  await actionListener({ id: 42, url: 'http://127.0.0.1:3004/' });
  assert.equal(JSON.stringify(records), storedBeforeFailure, 'failed storage write preserves previous article');
  chrome.storage.session.set = originalSet;
  let releaseCapture, actualCaptures = 0;
  chrome.scripting.executeScript = async () => { actualCaptures++; await new Promise(resolve => { releaseCapture = resolve; }); return [{ result: { html: '<p>single flight</p>', images: [], createdAt: Date.now() } }]; };
  const firstClick = actionListener({ id: 42, url: 'http://127.0.0.1:3004/' });
  await actionListener({ id: 42, url: 'http://127.0.0.1:3004/' });
  releaseCapture(); await firstClick; assert.equal(actualCaptures, 1, 'duplicate action does not start another capture');
  report.checks.push('atomic handoff write preserves old article on quota failure; repeated toolbar clicks capture once');
  let domainCaptures = 0;
  chrome.scripting.executeScript = async () => { domainCaptures++; return [{ result: { html: '<p>domain fixture</p>', images: [], createdAt: Date.now() } }]; };
  for (const origin of ['https://kaipai.itskairo.com']) await actionListener({ id: 42, url: origin + '/' });
  assert.equal(domainCaptures, 1);
  await actionListener({ id: 42, url: 'https://itskairo.com.evil.invalid/' });
  assert.equal(domainCaptures, 1, 'domain suffix spoof cannot capture');
  report.checks.push('kaipai.itskairo.com accepted without broader host permissions; lookalike domains rejected');
  chrome.scripting.executeScript = async () => { throw new Error('fixture readable capture error'); };
  await actionListener({ id: 42, url: 'http://127.0.0.1:3004/' });
  assert.ok(createdUrl.includes('#error=') && createdUrl.includes('source=42'));
  report.checks.push('capture failures open a visible error preparation page instead of only a toolbar badge');
  report.checks.push('worker action carries source tab, recovery captures fresh preview; unrelated message sender rejected');

  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const result = await page.evaluate(async () => {
      const { parseSession, validateUpload, uploadAll, replaceResources } = await import('/core.js');
      const { wechatRequest } = await import('/transport.js');
      let getRedirect, postRedirect;
      await wechatRequest('https://mp.weixin.qq.com/', {}, 100, async (_, options) => { getRedirect = options.redirect; return new Response('fixture'); });
      await wechatRequest('https://mp.weixin.qq.com/cgi-bin/filetransfer', { method: 'POST' }, 100, async (_, options) => { postRedirect = options.redirect; return new Response('{}'); });
      if (getRedirect !== 'follow' || postRedirect !== 'error') throw new Error('redirect policy incorrect');
      let rejectedRedirect = false;
      try { await fetch('/fixture-login-redirect', { redirect: 'error' }); } catch { rejectedRedirect = true; }
      if (!rejectedRedirect) throw new Error('native browser did not reproduce rejected login redirect');
      const dashboard = await wechatRequest('https://mp.weixin.qq.com/', {}, 100, async (_, options) => {
        const result = await fetch('/fixture-login-redirect', options);
        return new Response(await result.text());
      });
      if (!dashboard.includes('logged-in dashboard')) throw new Error('followed login redirect failed');
      let networkFailed = false;
      try { await wechatRequest('https://mp.weixin.qq.com/', {}, 100, async () => { throw new TypeError('Failed to fetch'); }); } catch (error) { networkFailed = error.message.includes('浏览器未能连接公众号'); }
      if (!networkFailed) throw new Error('network error lacks Chinese explanation');
      let oversized = false;
      try { await wechatRequest('https://mp.weixin.qq.com/', {}, 2, async () => new Response('oversized')); } catch (error) { oversized = error.message.includes('大小限制'); }
      if (!oversized) throw new Error('response limit missing');
      const { readHandoff, removeHandoff, HANDOFF_TTL, withDeadline } = await import('/handoff.js');
      const check = (condition, message) => { if (!condition) throw new Error(message); };
      const throws = fn => { try { fn(); return false; } catch { return true; } };
      check(throws(() => parseSession('<html>login</html>')), 'logged out rejected');
      const records = { first: { html: '<p>保留文章</p>', images: [], createdAt: 1000000 } };
      const storage = { get: async id => ({ [id]: records[id] }), remove: async id => { delete records[id]; } };
      const first = await readHandoff(storage, 'first', 1000001);
      check((await readHandoff(storage, 'first', 1000002)).html === first.html, 'refresh does not consume handoff');
      let expired = false;
      try { await readHandoff(storage, 'first', 1000000 + HANDOFF_TTL + 1); } catch (error) { expired = error.message.includes('超过 10 分钟'); }
      check(expired && !records.first, 'expired record removed with distinct explanation');
      let missing = false;
      try { await readHandoff(storage, 'missing', 1000000); } catch (error) { missing = error.message.includes('交接数据已丢失'); }
      check(missing, 'missing data does not masquerade as timeout');
      records['article-handoff'] = { id: 'newest', html: '<p>最新文稿</p>', images: [], createdAt: 1000000 };
      check((await readHandoff(storage, 'newest', 1000001)).html.includes('最新'), 'stable-key handoff readable');
      await removeHandoff(storage, 'stale');
      check(records['article-handoff'].id === 'newest', 'clearing an old page does not delete latest article');
      await removeHandoff(storage, 'newest'); check(!records['article-handoff'], 'matching current article clears');
      let deadlineReached = false;
      try { await withDeadline(new Promise(() => {}), 5, 'fixture timeout'); } catch (error) { deadlineReached = error.message === 'fixture timeout'; }
      check(deadlineReached, 'unanswered recovery message cannot wait forever');
      const session = parseSession('data: { t:"fixture" }; ticket:"x";user_name:"test";time:"123"');
      check(session.user === 'test', 'session parser');
      check(throws(() => validateUpload({ base_resp: { ret: 1 }, cdn_url: 'https://mmbiz.qpic.cn/a' })), 'upload error rejected');
      check(throws(() => validateUpload({ base_resp: { ret: 0 }, cdn_url: 'https://mmbiz.qpic.cn.evil.invalid/a' })), 'false CDN rejected');
      const sources = [{ source: 'data:one' }, { source: 'data:one' }, { source: 'data:two' }];
      let calls = 0;
      const map = await uploadAll(sources, async () => ({ base_resp: { ret: 0 }, cdn_url: `https://mmbiz.qpic.cn/${++calls}` }));
      check(calls === 2, 'duplicate resource uploads once');
      const html = '<section><img src="data:one" alt="顶部 | 封面"><p style="background:linear-gradient(transparent 52%,#fff07a 52%,#fff07a 92%,transparent 92%)">重点</p><section style="background-image:url(&quot;data:two&quot;)">背景</section><img src="data:one" alt="正文"></section>';
      const output = replaceResources(html, map);
      const doc = new DOMParser().parseFromString(output, 'text/html');
      check(doc.querySelectorAll('img').length === 2, 'top/body image positions retained');
      check(doc.querySelector('img').getAttribute('alt') === '顶部 | 封面', 'caption retained');
      check(doc.querySelector('p').getAttribute('style') === 'background:linear-gradient(transparent 52%,#fff07a 52%,#fff07a 92%,transparent 92%)', 'half gradient byte identical');
      check(doc.body.textContent === '重点背景', 'text/order retained');
      check(output.includes('https://mmbiz.qpic.cn/2'), 'background replaced');
      check(throws(() => replaceResources('<img src="x" onerror="alert(1)">', map)), 'active content rejected');
      let failed = false;
      try { await uploadAll([{ source: 'first' }, { source: 'second' }], async image => { if (image.source === 'second') throw new Error('fixture'); return { base_resp: { ret: 0 }, cdn_url: 'https://mmbiz.qpic.cn/ok' }; }); } catch { failed = true; }
      check(failed, 'partial upload never returns complete replacements');
      const cache = new Map(); const attempts = [];
      const retryImages = [{ source: 'one' }, { source: 'two' }];
      try { await uploadAll(retryImages, async image => { attempts.push(image.source); if (image.source === 'two') throw new Error('fixture interruption'); return { base_resp: { ret: 0 }, cdn_url: 'https://mmbiz.qpic.cn/one' }; }, () => {}, cache); } catch {}
      check(cache.size === 1, 'retain only confirmed successful upload on interruption');
      const completed = await uploadAll(retryImages, async image => { attempts.push(image.source); return { base_resp: { ret: 0 }, cdn_url: 'https://mmbiz.qpic.cn/two' }; }, () => {}, cache);
      check(completed.size === 2 && attempts.join(',') === 'one,two,two', 'retry only sends failed image, never repeats confirmed upload');
      return ['native browser 302 login redirect fails under old policy and succeeds under GET follow; upload POST redirects remain rejected', 'handoff survives repeated reads; true expiry removes data; missing record has recovery instructions', 'logged-out/upload-error/false-CDN rejected', 'deduplicated sequential uploads and atomic failure', 'top image, body image, caption, order and half gradient retained', 'CSS background URL replaced; active markup rejected'];
    });
    report.checks.push(...result, 'manifest limits persistent host access to WeChat; no cookie API or external messaging');
    const captureResult = await page.evaluate(async () => {
      const { captureArticle } = await import('/capture.js');
      const canvas = document.createElement('canvas'); canvas.width = 1100; canvas.height = 900;
      const context = canvas.getContext('2d'); const pixels = context.createImageData(1100, 900);
      let seed = 1234;
      for (let i = 0; i < pixels.data.length; i += 4) {
        for (let c = 0; c < 3; c++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels.data[i + c] = seed >>> 24; }
        pixels.data[i + 3] = 255;
      }
      context.putImageData(pixels, 0, 0);
      const large = canvas.toDataURL('image/png');
      const svg = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="red"/></svg>');
      const article = document.createElement('section'); article.className = 'v091-wechat-article';
      article.innerHTML = `<p style="background:linear-gradient(transparent 52%,yellow 52%)">半荧光</p><img src="${large}" alt="封面"><img src="${large}" alt="正文"><img src="${large}" alt="重复图"><img src="${svg}" alt="SVG示例">`;
      document.body.appendChild(article);
      const before = article.innerHTML;
      if (before.length < 2 * 1024 * 1024) throw new Error('fixture is too small');
      const capture = await captureArticle();
      if (capture.images.length !== 2) throw new Error('same image was duplicated');
      if (capture.html.length > 10000 || capture.html.includes(large)) throw new Error('inline images were not compacted');
      if (!capture.images.every(image => image.data.startsWith('data:image/png;base64,'))) throw new Error('SVG did not convert to PNG');
      if (article.innerHTML !== before) throw new Error('original article modified');
      if (!capture.html.includes('linear-gradient(transparent 52%,yellow 52%)')) throw new Error('half highlight changed');
      const bytes = new TextEncoder().encode(JSON.stringify(capture)).byteLength;
      if (bytes >= 8 * 1024 * 1024) throw new Error('handoff exceeds session storage');
      article.remove();
      return { originalHtmlCharacters: before.length, compactHtmlCharacters: capture.html.length, resourceCount: capture.images.length, handoffBytes: bytes };
    });
    report.captureLargeArticle = captureResult;
    if (actualArticleHtml) {
      report.actualArticleCapture = await page.evaluate(async () => {
        const { html } = await (await fetch('/capture-article.json')).json();
        const { captureArticle } = await import('/capture.js');
        const article = document.createElement('section'); article.className = 'v091-wechat-article'; article.innerHTML = html;
        document.body.appendChild(article); const original = article.innerHTML;
        const originalCount = article.querySelectorAll('img').length;
        const captured = await captureArticle();
        if (captured.images.length < 1 || captured.html.length > 2 * 1024 * 1024) throw new Error('actual article not compacted');
        const handoffBytes = new TextEncoder().encode(JSON.stringify(captured)).byteLength;
        if (handoffBytes >= 8 * 1024 * 1024) throw new Error('actual article still exceeds session budget');
        const { replaceResources } = await import('/core.js');
        const prepared = replaceResources(captured.html, new Map(captured.images.map((image, index) => [image.source, 'https://mmbiz.qpic.cn/fixture-' + index])));
        const doc = new DOMParser().parseFromString(prepared, 'text/html');
        if (doc.querySelectorAll('img').length !== originalCount || prepared.includes('kaipai-resource:')) throw new Error('actual article image positions lost');
        if (article.innerHTML !== original) throw new Error('actual source article changed');
        article.remove();
        return { originalHtmlCharacters: original.length, compactHtmlCharacters: captured.html.length, imagePositions: originalCount, uniqueResources: captured.images.length, handoffBytes, originalUnchanged: true };
      });
      report.checks.push('exported real article captured locally: original unchanged, all image positions retained, unique resources fit session quota');
    }
    report.checks.push('real capture function: repeated multi-MB inline images deduplicated to compact references; SVG rasterized to PNG; original and half highlight unchanged');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP7sAAAAASUVORK5CYII=';
    await page.addInitScript(({ png }) => {
      const fixture = { html: `<section><img src="${png}" alt="顶部封面"><p style="background:linear-gradient(transparent 52%,#fff07a 52%,#fff07a 92%,transparent 92%)">半荧光保留</p><img src="${png}" alt="正文配图"></section>`, images: [{ source: png, data: png }], createdAt: Date.now() };
      if (location.search === '?empty') { fixture.html = '<p>没有待上传图片的文章</p>'; fixture.images = []; }
      if (location.search === '?retry') { fixture.html = '<img src="kaipai-resource:0"><img src="kaipai-resource:1">'; fixture.images = [{ source: 'kaipai-resource:0', data: png }, { source: 'kaipai-resource:1', data: png }]; }
      if (!sessionStorage.getItem('mock-records')) sessionStorage.setItem('mock-records', JSON.stringify({ fixture }));
      window.chrome = { storage: { session: { get: async id => { const records = JSON.parse(sessionStorage.getItem('mock-records')); return { [id]: records[id] }; }, remove: async id => { const records = JSON.parse(sessionStorage.getItem('mock-records')); delete records[id]; sessionStorage.setItem('mock-records', JSON.stringify(records)); } } } };
      window.chrome.runtime = {
        getURL: name => location.origin + '/' + name,
        sendMessage: async message => {
          if (message.type === 'clear-handoff') { const records = JSON.parse(sessionStorage.getItem('mock-records')); delete records[message.id]; if (records['article-handoff']?.id === message.id) delete records['article-handoff']; sessionStorage.setItem('mock-records', JSON.stringify(records)); return { ok: true }; }
          const recovered = { ...fixture, html: fixture.html + '<p>重新读取成功后的最新文章</p>', createdAt: Date.now() };
          sessionStorage.setItem('mock-records', JSON.stringify({ recovered }));
          return { url: location.origin + '/prepare.html#id=recovered&source=42' };
        }
      };
      document.execCommand = () => false;
      const fetchOriginal = window.fetch.bind(window);
      window.fetch = async (url, options) => {
        if (String(url) === 'https://mp.weixin.qq.com/') return new Response(`data:{t:"fixture"};ticket:"x";user_name:"${window.fixtureAccount || 'test'}";time:"123"`);
        if (String(url).startsWith('https://mp.weixin.qq.com/cgi-bin/filetransfer?')) { window.fixtureUploads = (window.fixtureUploads || 0) + 1; if (window.failSecondUpload && window.fixtureUploads === 2) return Response.json({ base_resp: { ret: 1 } }); return Response.json({ base_resp: { ret: 0 }, cdn_url: 'https://mmbiz.qpic.cn/fixture/' + (window.fixtureAccount || 'test') + '/' + window.fixtureUploads }); }
        return fetchOriginal(url, options);
      };
      Object.defineProperty(navigator, 'clipboard', { value: { write: async items => { window.copied = await (await items[0].getType('text/html')).text(); } } });
    }, { png });
    await page.goto(`http://127.0.0.1:${server.address().port}/prepare.html#fixture`);
    await page.getByRole('button', { name: '将图片传到微信', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => !document.querySelector('#upload').disabled);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#upload').disabled);
    assert.ok(!(await page.locator('#status').innerText()).includes('已过期'));
    report.checks.push('real preparation script reload retains article with storage that actually removes records');
    const originalTransport = await page.evaluate(() => { window.__originalFetch = window.fetch; window.fetch = async (url, options) => { if (url === 'https://mp.weixin.qq.com/') throw new TypeError('Failed to fetch'); return window.__originalFetch(url, options); }; return true; });
    await page.getByRole('button', { name: '将图片传到微信', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('W02') && document.querySelector('#status').textContent.includes('浏览器未能连接公众号'));
    assert.ok(await page.locator('#copy').isDisabled());
    await page.evaluate(() => { window.fetch = window.__originalFetch; window.chrome.permissions = { contains: async () => false }; });
    await page.getByRole('button', { name: '将图片传到微信', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('W01') && document.querySelector('#status').textContent.includes('尚未获准'));
    assert.ok(await page.locator('#copy').isDisabled());
    await page.evaluate(() => { window.chrome.permissions.contains = async () => true; });
    report.checks.push('network and withheld permission failures show precise stage, preserve article and keep incomplete copy disabled; retry can succeed');
    await page.getByRole('button', { name: '将图片传到微信', exact: true }).click();
    await page.getByRole('button', { name: '复制完整图文', exact: true }).click();
    await page.waitForFunction(() => typeof window.copied === 'string');
    assert.ok((await page.evaluate(() => window.copied)).includes('https://mmbiz.qpic.cn/fixture'));
    report.checks.push('preparation UI fixture: explicit upload then clipboard, original half gradient kept');
    const clipboardChecks = await page.evaluate(async () => {
      const { copyRichHtml } = await import('/clipboard.js');
      const html = '<section><img src="https://mmbiz.qpic.cn/fixture"><strong style="background:linear-gradient(transparent 52%,yellow 52%)">重点</strong></section>';
      const assert = (value, label) => { if (!value) throw new Error(label); };
      let writes = 0;
      navigator.clipboard.write = async () => { writes++; throw new Error('denied'); };
      document.execCommand = () => {
        const data = new DataTransfer();
        document.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, cancelable: true }));
        window.legacyHtml = data.getData('text/html'); return true;
      };
      await copyRichHtml(html);
      assert(window.legacyHtml === html && writes === 0, 'compatibility path writes exact HTML synchronously');
      document.execCommand = () => true; // No copy event: must not falsely claim success.
      let failed = false;
      try { await copyRichHtml(html); } catch { failed = true; }
      assert(failed && writes === 1, 'false legacy success falls through and API failure is reported');
      document.execCommand = () => false;
      navigator.clipboard.write = async items => { window.copied = await (await items[0].getType('text/html')).text(); };
      await copyRichHtml(html);
      assert(window.copied === html, 'standard API preserves HTML');
      assert(!document.querySelector('span[style*="-10000px"]'), 'temporary node removed');
      return ['rich clipboard compatibility path, standard path, both-fail and false-success rejection'];
    });
    report.checks.push(...clipboardChecks);
    await page.screenshot({ path: path.join(out, 'desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'mobile.png'), fullPage: true });
    await page.getByRole('button', { name: '清除本次文章', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('本次文章已清除'));
    assert.ok(await page.getByRole('button', { name: '复制完整图文', exact: true }).isDisabled());
    report.checks.push('390px viewport and clearing captured article');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('交接数据已丢失'));
    assert.ok(await page.locator('#copy').isDisabled());
    await page.evaluate(() => sessionStorage.removeItem('mock-records'));
    report.checks.push('explicit clear remains cleared after reload with a precise recovery message');
    assert.ok(await page.getByRole('button', { name: '重新读取楷排文章', exact: true }).isEnabled());
    await page.getByRole('button', { name: '重新读取楷排文章', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('此页来自旧版插件'));
    report.checks.push('missing data leaves recovery button enabled, including guidance for old preparation links');
    await page.goto(`http://127.0.0.1:${server.address().port}/prepare.html?empty#fixture`);
    await page.getByRole('button', { name: '复制完整图文', exact: true }).click();
    await page.waitForFunction(() => window.copied?.includes('没有待上传图片的文章'));
    assert.ok(await page.getByRole('button', { name: '将图片传到微信', exact: true }).isDisabled());
    report.checks.push('no pending images: copy directly without a WeChat request');
    await page.goto(`http://127.0.0.1:${server.address().port}/prepare.html?error-case#error=fixture-visible-error&source=42`);
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'fixture-visible-error');
    assert.ok(await page.getByRole('button', { name: '重新读取楷排文章', exact: true }).isEnabled());
    await page.evaluate(() => sessionStorage.clear());
    await page.goto(`http://127.0.0.1:${server.address().port}/prepare.html?recovery-case#id=missing&source=42`);
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('交接数据已丢失'));
    await page.getByRole('button', { name: '重新读取楷排文章', exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('#upload').disabled && document.querySelector('#status').textContent.includes('已读取文章'), null, { timeout: 2500 });
    assert.ok((await page.frameLocator('#preview').locator('body').innerText()).includes('重新读取成功后的最新文章'));
    await page.screenshot({ path: path.join(out, 'recovery-loaded.png'), fullPage: true });
    await page.getByRole('button', { name: '将图片传到微信', exact: true }).click();
    await page.getByRole('button', { name: '复制完整图文', exact: true }).click();
    await page.waitForFunction(() => window.copied?.includes('重新读取成功后的最新文章'));
    await page.getByRole('button', { name: '清除本次文章', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('本次文章已清除'));
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('mock-records')).recovered), undefined);
    report.checks.push('missing handoff -> recover click -> new fragment -> updated preview -> enabled upload -> complete copy -> clear new record');

    for (const changeAccount of [false, true]) {
      await page.evaluate(() => sessionStorage.clear());
      await page.goto(`http://127.0.0.1:${server.address().port}/prepare.html?retry#id=fixture&source=42`);
      await page.reload(); // same URL may only change fragment after the first loop
      await page.evaluate(() => { window.failSecondUpload = true; });
      await page.getByRole('button', { name: '将图片传到微信', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#status').textContent.includes('失败') && window.fixtureUploads === 2);
      assert.ok(await page.locator('#copy').isDisabled());
      if (changeAccount) await page.evaluate(() => { window.fixtureAccount = 'another-account'; });
      await page.getByRole('button', { name: '将图片传到微信', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('#copy').disabled);
      assert.equal(await page.evaluate(() => window.fixtureUploads), changeAccount ? 4 : 3);
      await page.getByRole('button', { name: '复制完整图文', exact: true }).click();
      await page.waitForFunction(() => typeof window.copied === 'string');
      if (changeAccount) assert.ok(!(await page.evaluate(() => window.copied)).includes('/test/'));
    }
    report.checks.push('page retry skips confirmed upload for same account; account switch reuploads all and never reuses previous account image URLs');
    await page.evaluate(() => { navigator.clipboard.write = () => new Promise(resolve => { window.finishCopy = resolve; }); });
    await page.getByRole('button', { name: '复制完整图文', exact: true }).click();
    await page.getByRole('button', { name: '清除本次文章', exact: true }).click();
    assert.ok((await page.evaluate(() => JSON.parse(sessionStorage.getItem('mock-records')))).fixture);
    await page.evaluate(() => window.finishCopy());
    await page.waitForFunction(() => !document.querySelector('#copy').disabled);
    report.checks.push('clear is blocked while clipboard write is in progress, preventing stale completion from changing another article');
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
