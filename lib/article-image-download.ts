import type { PublicationImage } from './wechat-publication';

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

async function readImage(source: string): Promise<Blob> {
    if (!source) throw new Error('图片地址为空');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error(`图片读取失败（${response.status}）`);
        const blob = await response.blob();
        if (blob.size && /^image\/(png|jpeg)$/i.test(blob.type)) return blob;
        // SVG, WebP and other formats become uploadable PNG files.
        const url = URL.createObjectURL(blob);
        try { return await rasterPng(url); } finally { URL.revokeObjectURL(url); }
    } finally { window.clearTimeout(timeout); }
}

export async function createArticleImagePackage(images: PublicationImage[], read = readImage) {
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
    zip.file('上传说明.txt', '1. 在楷排复制公众号正文，粘贴到公众号编辑器。\n2. 解压图片包，按插图编号找到正文中的「待上传」位置。\n3. 在公众号后台上传对应图片，并删掉该位置的提示文字；图注已在正文保留。\n4. 背景素材需上传后取得微信图片地址，填回楷排，再复制正文。\n5. 保存草稿并预览，检查图片与排版。\n\n图片文件是原图（SVG 等转为 PNG），不包含外层排版边框或拍立得装饰；装饰属于正文 HTML，后台需检查保留效果。');
    if (failures.length) zip.file('未下载图片.txt', failures.join('\n\n'));
    return { blob: await zip.generateAsync({ type: 'blob' }), count, failed: failures.length };
}
