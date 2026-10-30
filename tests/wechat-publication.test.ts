import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { listPublicationImages, isWechatImage } from '../lib/wechat-publication';
import { createArticleImagePackage } from '../lib/article-image-download';
import { markdownToWechat, htmlToPlainText } from '../lib/wechat-html';
import { allStyles, styles } from '../lib/styles';

export async function run() {
    assert.equal(isWechatImage('https://mmbiz.qpic.cn/mmbiz_png/abc/0'), true);
    assert.equal(isWechatImage('https://mmbiz.qpic.cn.evil.test/a.png'), false);
    assert.equal(isWechatImage('data:image/png;base64,abc'), false);
    const source = 'data:image/svg+xml,%3Csvg%3E%3C/svg%3E';
    for (const style of styles) {
        const original = markdownToWechat(`# 标题\n\n![第一张图](${source})\n\n![微信图](https://mmbiz.qpic.cn/mmbiz_png/abc/0)\n\n![重复图](${source})`, style.accent, '#ffff00', style.id);
        const resources = listPublicationImages(original);
        assert.equal(resources.length, 2);
        assert.equal(resources[0].name, '插图-01');
        assert.equal(resources[1].name, '插图-03');
        assert.equal(resources[0].source, source);
    }
    for (const style of allStyles) {
        for (const kind of ['lead', 'callout', 'tip', 'warn', 'author']) {
            const caption = '封面 | 20 世纪中期商业插画';
            const original = markdownToWechat(`:::${kind}\n图片前的正文\n![${caption}](${source})\n图片后的正文\n:::\n\n![正文图](sample://image)`, style.accent, '#fff07a', style.id);
            assert.equal((original.match(/<img\b/g) || []).length, 2, `${style.id}/${kind}: component and body images must both render`);
            assert.ok(original.includes(`src="${source}"`) && original.includes(`alt="${caption}"`));
            const text = htmlToPlainText(original);
            assert.ok(text.includes('图片前的正文') && text.includes('图片后的正文') && text.includes(caption));
            assert.ok(original.indexOf('图片前的正文') < original.indexOf('<img') && original.indexOf('<img') < original.indexOf('图片后的正文'));
            const resources = listPublicationImages(original);
            assert.equal(resources.length, 2);
            assert.equal(resources[0].label, caption);
        }
    }
    assert.deepEqual(listPublicationImages('<p>正文 url(/paper.png)</p>'), []);
    assert.equal(listPublicationImages('<section style="background-image:url(\'/paper.png\')">正文</section>')[0].source, '/paper.png');
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
    assert.ok((await zip.file('上传说明.txt')!.async('string')).includes('备用原图包'));
    await assert.rejects(createArticleImagePackage(images, async () => new Blob([], { type: 'image/png' })), /所有图片下载失败/);
    await assert.rejects(createArticleImagePackage([], async () => bitmap), /没有需要上传/);
    console.log('PASS: component images/captions/order, resource collection, original image packages and download failures');
}
