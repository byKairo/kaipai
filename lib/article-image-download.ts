import type { PublicationImage } from './wechat-publication';
import { boundedResponseChunks } from './response-body';

/** Rasterization is for downloadable files, never for pretending to upload through the clipboard. */
async function rasterPng(source: string): Promise<Blob> {
    const image = new Image();
    if (/^https?:/i.test(source)) image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => { image.onload = null; image.onerror = null; reject(new Error('图片读取超时')); }, 12000);
        image.onload = () => { window.clearTimeout(timeout); resolve(); };
        image.onerror = () => { window.clearTimeout(timeout); reject(new Error('图片不可读取，网络图片可能限制跨域下载')); };
        image.src = source;
    });
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!width || !height) throw new Error('图片尺寸无效');
    const scale = Math.min(1, 2400 / width, Math.sqrt(16000000 / (width * height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器无法转换图片');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 导出失败')), 'image/png'));
}

export async function readArticleImage(source: string, signal?: AbortSignal): Promise<Blob> {
    if (!source) throw new Error('图片地址为空');
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error(`图片读取失败（${response.status}）`);
        const chunks: Uint8Array[] = [];
        for await (const chunk of boundedResponseChunks(response, 24 * 1024 * 1024)) chunks.push(chunk);
        const blob = new Blob(chunks, { type: response.headers.get('content-type')?.split(';')[0] || '' });
        if (blob.size && /^image\/(png|jpeg)$/i.test(blob.type)) return blob;
        // SVG, WebP and other formats become uploadable PNG files.
        const url = URL.createObjectURL(blob);
        try { return await rasterPng(url); } finally { URL.revokeObjectURL(url); }
    } finally { window.clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export async function createArticleImagePackage(images: PublicationImage[], read = readArticleImage) {
    if (!images.length) throw new Error('没有需要上传的图片');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const entries: string[] = [];
    const failures: string[] = [];
    const cache = new Map<string, Blob>();
    let count = 0;
    for (const image of images) {
        try {
            let blob = cache.get(image.source);
            if (!blob) { blob = await read(image.source); cache.set(image.source, blob); }
            if (!blob.size || !/^image\/(png|jpeg)$/i.test(blob.type)) throw new Error('未得到有效 PNG/JPEG 文件');
            const filename = `${image.name}.${blob.type.toLowerCase() === 'image/jpeg' ? 'jpg' : 'png'}`;
            zip.file(filename, await blob.arrayBuffer());
            entries.push(`${filename}：${image.label}`);
            count += 1;
        } catch (error) {
            failures.push(`${image.name}：${image.label}\n原因：${error instanceof Error ? error.message : '读取失败'}${/^https?:/i.test(image.source) ? `\n原地址：${image.source}` : ''}`);
        }
    }
    if (!count) throw new Error(`所有图片下载失败：${failures[0] || '图片不可读取'}`);
    zip.file('图片与图注.txt', entries.join('\n'));
    zip.file('上传说明.txt', '这是文章备用原图包，包含原图与图注。\n1. 本地图片可使用楷排插件上传到微信，再复制完整图文。\n2. 如需手动处理，可先导出 HTML 留存排版，按图片与图注.txt 中的编号在公众号原位置插入对应图片。\n3. 保存草稿并预览，检查图片和排版。\n\nPNG/JPEG 保留原图；SVG 等转为 PNG。图片文件不包含外层排版边框，外框与背景属于正文 HTML。');
    if (failures.length) zip.file('未下载图片.txt', failures.join('\n\n'));
    return { blob: await zip.generateAsync({ type: 'blob' }), count, failed: failures.length };
}
