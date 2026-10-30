/** Keep the existing PNG/data-URL storage format while encoding off the synchronous input path. */
export async function cropGeneratedImage(src: string, ratio: string, signal: AbortSignal): Promise<string> {
  const check = () => { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError'); };
  check();
  const source = new Image();
  source.src = src;
  await source.decode();
  check();
  const [widthRatio, heightRatio] = ratio.split(':').map(Number);
  if (!(widthRatio > 0 && heightRatio > 0 && Number.isFinite(widthRatio / heightRatio))) throw new Error('图片比例无效');
  const width = Math.min(source.naturalWidth, source.naturalHeight * widthRatio / heightRatio);
  const height = width * heightRatio / widthRatio;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width); canvas.height = Math.round(height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法处理图片尺寸，请重试');
  context.drawImage(source, (source.naturalWidth - width) / 2, (source.naturalHeight - height) / 2, width, height, 0, 0, canvas.width, canvas.height);
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error('图片编码失败，请重试')), 'image/png');
    });
    check();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      const cancel = () => { release(); reader.abort(); reject(new DOMException('Cancelled', 'AbortError')); };
      const release = () => signal.removeEventListener('abort', cancel);
      reader.onload = () => { release(); resolve(String(reader.result)); };
      reader.onerror = () => { release(); reject(reader.error || new Error('图片读取失败')); };
      reader.onabort = release;
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) { cancel(); return; }
      reader.readAsDataURL(blob);
    });
  } finally {
    // Release the temporary pixel buffer; the editor retains only the encoded image.
    canvas.width = 0; canvas.height = 0;
  }
}
