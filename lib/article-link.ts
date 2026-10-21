/** Keep article links inert unless the browser resolves them to a safe protocol. */
export function safeArticleLink(value: string): string | null {
  const href = value.trim();
  // Browsers ignore embedded tabs/newlines in schemes. Reject them rather than
  // turning an apparently harmless string into an executable URL.
  if (!href || /[\u0000-\u001f\u007f]/.test(href)) return null;
  try {
    const url = new URL(href, 'https://article.invalid/');
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? href : null;
  } catch { return null; }
}
