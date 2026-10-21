// 内容的视觉规则已经完整内联在公众号 HTML 中。独立文件不再额外覆盖它，
// 因此下载后看到的结果与复制到公众号的版本来自完全相同的输出。
const standaloneStyles = `body{margin:0;padding:24px;background:#eef1f0}article{max-width:677px;margin:0 auto;background:transparent}img{max-width:100%;height:auto}`;

export function makeStandaloneHtml(content: string, title = '楷排文章') {
  const safeTitle = title.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]!));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>${standaloneStyles}</style></head><body><article>${content}</article></body></html>`;
}
