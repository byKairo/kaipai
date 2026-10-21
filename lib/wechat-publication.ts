import { escapeHtml } from './wechat-text';

export type PublicationImage = { source: string; label: string; name: string };
function decodeAttribute(value: string) {
    return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function attribute(tag: string, name: string) {
    const match = tag.match(new RegExp(`\\b${name}=["']([^"']*)["']`, 'i'));
    return match ? decodeAttribute(match[1]) : '';
}
export function isWechatImage(source: string) {
    return /^https?:\/\/mmbiz\.qpic\.cn\//i.test(source);
}

/** Only the publication copy changes. The editable document and preview retain their originals. */
export function prepareWechatPublication(html: string) {
    const images: PublicationImage[] = [];
    let index = 0;
    let output = html.replace(/<img\b[^>]*>/gi, tag => {
        index += 1;
        const source = attribute(tag, 'src');
        if (isWechatImage(source)) return tag;
        const name = `插图-${String(index).padStart(2, '0')}`;
        const label = attribute(tag, 'alt') || '无图注';
        images.push({ source, label, name });
        return `<span style="display:block;padding:12px;color:#666666;font-size:14px;line-height:22px;text-align:center;">[待上传 ${name}：${escapeHtml(label)}]</span>`;
    });
    // Local/third-party textures and cover backgrounds have the same source problem as img.
    output = output.replace(/\bstyle=(["'])([\s\S]*?)\1/gi, (attribute, quote: string, style: string) => {
        const cleaned = style.replace(/url\(['"]?([^'"\)]+)['"]?\)/gi, (match, value: string) => {
            const source = decodeAttribute(value);
            if (isWechatImage(source)) return match;
            if (!images.some(image => image.source === source)) {
                images.push({ source, label: '背景素材：上传后在楷排填写微信图片地址，再复制正文', name: `背景-${String(images.filter(image => image.name.startsWith('背景-')).length + 1).padStart(2, '0')}` });
            }
            return 'none';
        });
        return cleaned === style ? attribute : `style=${quote}${cleaned}${quote}`;
    });
    return { html: output, images };
}
