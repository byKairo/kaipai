/** Publication resource checks are separate from typography compliance. Neither simulates WeChat's editor. */
export function wechatResourceNotice(html: string): string {
    const localImage = /<img[^>]+src="(?:data:|blob:|\/(?!\/)|https?:\/\/(?:localhost|127\.0\.0\.1))/i.test(html);
    const localTexture = /background-image:url\(['"]?(?:data:|blob:|\/(?!\/)|https?:\/\/(?:localhost|127\.0\.0\.1))/i.test(html);
    const items = [localImage ? '正文图片需上传公众号素材' : '', localTexture ? '纸纹需上传素材并填写微信素材地址' : ''].filter(Boolean);
    return items.length ? items.join('；') : '';
}
