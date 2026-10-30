import assert from 'node:assert/strict';
import { articleCopyImages, prepareArticleCopy, isStoredArticleImage } from '../lib/article-copy-assets';
import { createImageUploadSession, uploadArticleImage, imageAssetsReady, MAX_ARTICLE_IMAGE_BYTES } from '../lib/server/image-assets';
import type { ImageAssetBindings } from '../lib/server/image-assets-runtime';
import { markdownToWechat } from '../lib/wechat-html';
import { allStyles } from '../lib/styles';

export async function run() {
  const origin = 'https://kaipai.example';
  const url = `${origin}/api/article-assets/${'a'.repeat(64)}.png`;
  const source = 'data:image/png;base64,fixture';
  for (const style of allStyles) {
    const html = markdownToWechat(`:::lead\n![封面 | 图注](${source})\n重点 **强调**。\n:::\n\n![重复使用](${source})`, style.accent, '#fff07a', style.id);
    const calls: string[] = [];
    const copied = await prepareArticleCopy(html, origin, async src => { calls.push(src); return url; });
    assert.deepEqual(calls, [source], 'duplicate images upload once');
    assert.equal((copied.match(/<img\b/g) || []).length, 2);
    assert.equal(copied, html.split(source).join(url), `${style.id}: only the image address changes; layout/captions/highlights stay intact`);
    assert.equal(articleCopyImages(copied, origin).length, 0);
  }
  for (const resource of [`url('${source}')`, `url(&quot;${source}&quot;)`]) {
    const html = `<section style="background-image:linear-gradient(red,transparent),${resource};padding:17px;">正文</section>`;
    assert.equal(articleCopyImages(html, origin)[0].source, source);
    const copied = await prepareArticleCopy(html, origin, async () => url);
    assert.ok(copied.includes(url) && copied.includes('linear-gradient(red,transparent)') && copied.includes('padding:17px'));
    assert.ok(!copied.includes(source));
  }
  const trusted = '<img src="https://mmbiz.qpic.cn/a.png" alt="微信图">';
  assert.equal(await prepareArticleCopy(trusted, origin, async () => { throw new Error('must not upload'); }), trusted);
  assert.equal(isStoredArticleImage(`https://other.example/api/article-assets/${'a'.repeat(64)}.png`, origin), false);
  assert.equal(isStoredArticleImage(url + '?tracking=1', origin), false);
  await assert.rejects(prepareArticleCopy(`<img src="${source}">`, origin, async () => 'https://other.example/image.png'), /有效地址/);
  const controller = new AbortController();
  await assert.rejects(prepareArticleCopy(`<img src="${source}">`, origin, async () => { controller.abort(); return url; }, controller.signal), { name: 'AbortError' });
  await assert.rejects(prepareArticleCopy('<img src="one"><img src="two">', origin, async src => { if (src === 'two') throw new Error('upload failed'); return url; }), /upload failed/);

  const objects = new Map<string, Uint8Array>(); let writes = 0;
  let allowed = true;
  const env: ImageAssetBindings = {
    bucket: { async head(key) { return objects.get(key) || null; }, async put(key, bytes) { writes++; objects.set(key, bytes); return {}; }, async get() { return null; } },
    limiter: { async limit() { return { success: allowed }; } }, siteKey: 'site-key', turnstileSecret: 'server-secret', sessionSecret: 'x'.repeat(40),
  };
  assert.equal(imageAssetsReady({}), false);
  const verify: typeof fetch = async () => new Response(JSON.stringify({ success: true, hostname: 'kaipai.example', action: 'article-images' }));
  const cookie = await createImageUploadSession(env, 'valid-token', 'kaipai.example', '192.0.2.1', verify);
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/);
  const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN4AAAAASUVORK5CYII=', 'base64'));
  const request = (body = png, contentType = 'image/png', auth = cookie) => new Request(origin + '/api/article-assets', { method: 'POST', body, headers: { 'Content-Type': contentType, cookie: auth } });
  const uploaded = await uploadArticleImage(env, request(), '192.0.2.1');
  assert.ok(isStoredArticleImage(uploaded.url, origin));
  assert.deepEqual(Array.from(objects.values())[0], png);
  await uploadArticleImage(env, request(), '192.0.2.1'); assert.equal(writes, 1, 'identical bytes reuse the immutable object');
  await assert.rejects(uploadArticleImage({}, request(), '192.0.2.1'), { status: 503 });
  await assert.rejects(uploadArticleImage(env, request(), '192.0.2.2'), { status: 401 });
  await assert.rejects(uploadArticleImage(env, request(png, 'image/png', ''), '192.0.2.1'), { status: 401 });
  await assert.rejects(uploadArticleImage(env, request(new Uint8Array([1,2,3])), '192.0.2.1'), { status: 415 });
  await assert.rejects(uploadArticleImage(env, request(png, 'image/svg+xml'), '192.0.2.1'), { status: 415 });
  const oversized = request(); oversized.headers.set('Content-Length', String(MAX_ARTICLE_IMAGE_BYTES + 1));
  await assert.rejects(uploadArticleImage(env, oversized, '192.0.2.1'), { status: 413 });
  await assert.rejects(createImageUploadSession(env, 'wrong-token', 'kaipai.example', '192.0.2.1', async () => new Response(JSON.stringify({ success: true, hostname: 'elsewhere', action: 'article-images' }))), { status: 403 });
  allowed = false;
  await assert.rejects(uploadArticleImage(env, request(), '192.0.2.1'), { status: 429 });
  assert.equal(writes, 1, 'invalid/unauthorized/oversized/rate-limited requests never write an image');
  console.log('PASS: original image positions/layout retained across all styles, atomic copy preparation, aborts, deduplication, protected bounded storage uploads');
}
