import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { prepareWechatPublication, isWechatImage } from '../lib/wechat-publication';
import { createArticleImagePackage } from '../lib/article-image-download';
import { markdownToWechat, htmlToPlainText } from '../lib/wechat-html';
import { styles } from '../lib/styles';

export async function run() {
    assert.equal(isWechatImage('https://mmbiz.qpic.cn/mmbiz_png/abc/0'), true);
    assert.equal(isWechatImage('https://mmbiz.qpic.cn.evil.test/a.png'), false);
    assert.equal(isWechatImage('data:image/png;base64,abc'), false);
    const source = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E';
    for (const style of styles) {
        const original = markdownToWechat(`# 标题\n\n正文保留。\n\n![第一张图](${source})\n\n![微信图](https://mmbiz.qpic.cn/mmbiz_png/abc/0)\n\n![重复图](${source})\n\n> 引用保留。`, style.accent, '#ffff00', style.id, 24);
        const prepared = prepareWechatPublication(original);
        const text = htmlToPlainText(prepared.html);
        assert.ok(text.includes('标题') && text.includes('正文保留。') && text.includes('引用保留。'), style.id);
        assert.ok(prepared.html.includes('待上传 插图-01：第一张图'));
        assert.ok(prepared.html.includes('待上传 插图-03：重复图'));
        assert.ok(prepared.html.includes('src="https://mmbiz.qpic.cn/mmbiz_png/abc/0"'));
        assert.ok(!prepared.html.includes(source), 'Inline images must not masquerade as uploaded images');
        assert.ok(prepared.html.includes('第一张图</p>'), 'Keep the real caption besides the upload marker');
        assert.equal(prepared.images.filter(i => i.name.startsWith('插图-')).length, 2);
    }
    const shell = '<section style="background:#fff;background-image:url(\'/paper.png\');"><figure style="padding:12px;border:3px solid #111"><img src="/photo.png" alt="&lt;不执行&gt; &quot;引号&quot;"><p>图注</p></figure></section>';
    const prepared = prepareWechatPublication(shell);
    assert.ok(prepared.html.includes('padding:12px;border:3px solid #111'));
    assert.ok(prepared.html.includes('background-image:none'));
    assert.equal(prepared.images[1].name, '背景-01');
    assert.ok(prepared.html.includes('&lt;不执行&gt;'), 'Markers must never inject markup');
    const literal = '<p>正文示例 url(/paper.png) 必须保留。</p>';
    assert.equal(prepareWechatPublication(literal).html, literal, 'Only CSS URLs are resources; body text is untouched');
    assert.equal(prepareWechatPublication('<h1>纯文字</h1>').html, '<h1>纯文字</h1>');
    const bitmap = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN4AAAAASUVORK5CYII=', 'base64')], { type: 'image/png' });
    const images = [{ source, name: '插图-01', label: '第一张图' }, { source, name: '插图-02', label: '重复图' }, { source: 'https://blocked.test/a', name: '插图-03', label: '下载受限' }];
    const calls: string[] = [];
    const result = await createArticleImagePackage(images, async src => { calls.push(src); if (src.includes('blocked')) throw new Error('跨域限制'); return bitmap; });
    assert.deepEqual(calls, [source, 'https://blocked.test/a'], 'Repeated originals read once, but every article position gets its own filename');
    assert.equal(result.count, 2);
    assert.equal(result.failed, 1);
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    assert.deepEqual(await zip.file('插图-01.png')!.async('uint8array'), new Uint8Array(await bitmap.arrayBuffer()));
    assert.ok((await zip.file('图片与图注.txt')!.async('string')).includes('插图-02.png：重复图'));
    assert.ok((await zip.file('未下载图片.txt')!.async('string')).includes('https://blocked.test/a'));
    assert.ok((await zip.file('上传说明.txt')!.async('string')).includes('删掉该位置的提示文字'));
    await assert.rejects(createArticleImagePackage(images, async () => new Blob([], { type: 'image/png' })), /所有图片下载失败/);
    await assert.rejects(createArticleImagePackage([], async () => bitmap), /没有需要上传/);
    console.log('PASS: 12 styles keep text/captions/framing, reject unsupported image sources, package image files/positions and disclose failures');
}
