export type PublicationImage = { source: string; label: string; name: string };
function decodeAttribute(value: string) {
    return value.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
function attribute(tag: string, name: string) {
    const match = tag.match(new RegExp(`\\s${name}=(["'])(.*?)\\1`, 'i'));
    return match ? decodeAttribute(match[2]) : '';
}
export function isWechatImage(source: string) { return /^https?:\/\/mmbiz\.qpic\.cn\//i.test(source); }

/** Resource list for automatic transfer and optional downloads. The HTML is never changed here. */
export function listPublicationImages(html: string): PublicationImage[] {
    const images: PublicationImage[] = [];
    let index = 0;
    for (const tag of html.match(/<img\b[^>]*>/gi) || []) {
        index++;
        const source = attribute(tag, 'src');
        if (!isWechatImage(source)) images.push({ source, label: attribute(tag, 'alt') || '无图注', name: `插图-${String(index).padStart(2, '0')}` });
    }
    for (const style of Array.from(html.matchAll(/\bstyle=(["'])([\s\S]*?)\1/gi))) {
        for (const match of Array.from(decodeAttribute(style[2]).matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi))) {
            const source = match[1] ?? match[2] ?? match[3].trim();
            if (isWechatImage(source) || images.some(image => image.source === source)) continue;
            images.push({ source, label: '文章背景', name: `背景-${String(images.filter(image => image.name.startsWith('背景-')).length + 1).padStart(2, '0')}` });
        }
    }
    return images;
}
