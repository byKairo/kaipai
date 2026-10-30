export type ArticleSuggestion = {
  id: string;
  kind: 'replace' | 'emphasis' | 'clarify';
  quote: string;
  prefix: string;
  suffix: string;
  replacement: string | null;
  presentation: 'bold' | 'highlight';
  reason: string;
};
export type ReviewItem = ArticleSuggestion & { from: number; to: number };
export type ReviewState = { items: ReviewItem[]; activeId: string | null };

/** Suggestions are data, never HTML, document marks, or executable model output. */
export function parseArticleSuggestions(value: unknown): ArticleSuggestion[] {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { suggestions?: unknown }).suggestions)) throw new Error('建议格式无法识别，请重试；原文未修改。');
  const result: ArticleSuggestion[] = [];
  for (const raw of (value as { suggestions: unknown[] }).suggestions.slice(0, 30)) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    if (!['replace', 'emphasis', 'clarify'].includes(String(item.kind)) || typeof item.quote !== 'string' || !item.quote.trim() || item.quote.length > 500 || typeof item.reason !== 'string' || !item.reason.trim()) continue;
    if (item.kind === 'replace' && (typeof item.replacement !== 'string' || !item.replacement.trim() || item.replacement.length > 1000 || /[\r\n]/.test(item.replacement) || item.replacement === item.quote)) continue;
    result.push({ id: `review-${result.length + 1}`, kind: item.kind as ArticleSuggestion['kind'], quote: item.quote,
      prefix: typeof item.prefix === 'string' ? item.prefix.slice(-200) : '', suffix: typeof item.suffix === 'string' ? item.suffix.slice(0, 200) : '',
      replacement: item.kind === 'replace' ? item.replacement as string : null,
      presentation: item.presentation === 'highlight' ? 'highlight' : 'bold', reason: item.reason.trim().slice(0, 180) });
    if (result.length >= 10) break;
  }
  return result;
}


/** The editor installs its adapter when mounted; the shell imports no editor runtime. */
export type ArticleReviewController = {
  clear(): void;
  select(id: string | null, scroll?: boolean): void;
  locate(suggestions: ArticleSuggestion[]): ReviewItem[];
  set(items: ReviewItem[]): void;
  adopt(id: string): boolean;
  dismiss(id: string): void;
};
const controllers = new WeakMap<object, ArticleReviewController>();
export const getArticleReviewController = (view: object) => controllers.get(view);
export function registerArticleReviewController(view: object, controller: ArticleReviewController) {
  controllers.set(view, controller);
  return () => { if (controllers.get(view) === controller) controllers.delete(view); };
}
