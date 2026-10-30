// Replaced from the current client manifest by finalize-cloudflare.cjs.
const editorHref = '__KAIPAI_EDITOR_PRELOAD_HREF__';
type EndTag = { before(content: string, options: { html: boolean }): void };
type Element = { getAttribute(name: string): string | null; onEndTag(handler: (end: EndTag) => void): void };
type Rewriter = { on(selector: string, handler: { element(element: Element): void }): Rewriter; transform(response: Response): Response };
type RewriterConstructor = new () => Rewriter;

/** Keep the response streaming; do not compete with the inline first-paint CSS. */
export function preloadEditor(request: Request, response: Response): Response {
  if (request.method !== 'GET' || new URL(request.url).pathname !== '/' || response.status !== 200 ||
      !response.body || !/^text\/html(?:;|$)/i.test(response.headers.get('content-type') || '') ||
      /nonce-/i.test(response.headers.get('content-security-policy') || '')) return response;
  const Rewriter = (globalThis as typeof globalThis & { HTMLRewriter?: RewriterConstructor }).HTMLRewriter;
  if (!Rewriter) return response;
  let existing = false;
  const rewriter = new Rewriter()
    .on('link[rel="modulepreload"]', { element(link) { if (link.getAttribute('href') === editorHref) existing = true; } })
    .on('head', { element(head) { head.onEndTag(end => {
      if (!existing) end.before(`<link rel="modulepreload" href="${editorHref}" crossorigin="" fetchpriority="low">`, { html: true });
    }); } });
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  return rewriter.transform(new Response(response.body, { status: response.status, statusText: response.statusText, headers }));
}
