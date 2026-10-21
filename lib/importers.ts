export async function importDocx(file: File) {
  if (!/\.docx$/i.test(file.name)) throw new Error('请选择 .docx 格式的 Word 文稿');
  try {
    // mammoth 的浏览器构建在不同打包器中可能以 default 或 named export 暴露。
    // 同时兼容两种形式，避免用户导入时落到 “convertToHtml is not a function”。
    const module: any = await import('mammoth/mammoth.browser');
    const mammoth = module.default ?? module;
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    if (!result.value.trim()) throw new Error('没有读取到可编辑的正文内容');
    return result.value;
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知错误';
    throw new Error(`Word 导入失败：${detail}`);
  }
}

export async function importPdf(file: File) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const text = await page.getTextContent();
    pages.push('<p>' + text.items.map(item => 'str' in item ? item.str : '').join(' ') + '</p>');
  }
  return pages.join('');
}
