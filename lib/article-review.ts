import type { Node as DocumentNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { registerArticleReviewController, type ArticleSuggestion, type ReviewItem, type ReviewState } from './article-review-client';
export { parseArticleSuggestions } from './article-review-client';
export type { ArticleSuggestion, ReviewItem, ReviewState } from './article-review-client';
type ReviewAction = { type: 'set'; items: ReviewItem[] } | { type: 'select'; id: string | null } | { type: 'remove'; id: string };
export const articleReviewKey = new PluginKey<ReviewState>('articleReview');
const empty: ReviewState = { items: [], activeId: null };


function safeRange(doc: DocumentNode, from: number, to: number, quote: string) {
  if (from < 1 || to > doc.content.size || from >= to) return false;
  const a = doc.resolve(from), b = doc.resolve(to);
  if (a.parent !== b.parent || !a.parent.isTextblock || a.parent.type.spec.code || doc.textBetween(from, to, '', '\uFFFC') !== quote) return false;
  let safe = true;
  doc.nodesBetween(from, to, node => {
    if (node.isInline && (!node.isText || node.marks.some(mark => mark.type.name === 'code' || mark.type.name === 'link'))) safe = false;
  });
  return safe;
}

/** Resolve exact, unique visible text. Markdown offsets are never editor positions. */
export function locateArticleSuggestions(doc: DocumentNode, suggestions: ArticleSuggestion[]): ReviewItem[] {
  const result: ReviewItem[] = [];
  for (const item of suggestions) {
    const matches: Array<{ from: number; to: number }> = [];
    doc.descendants((node, pos) => {
      if (!node.isTextblock || node.type.spec.code) return;
      const text = node.textBetween(0, node.content.size, '', '\uFFFC');
      let at = -1;
      while ((at = text.indexOf(item.quote, at + 1)) !== -1) {
        if (text.slice(0, at).endsWith(item.prefix) && text.slice(at + item.quote.length).startsWith(item.suffix)) matches.push({ from: pos + 1 + at, to: pos + 1 + at + item.quote.length });
      }
      return false;
    });
    if (matches.length !== 1) continue;
    const range = matches[0];
    if (!safeRange(doc, range.from, range.to, item.quote) || result.some(other => range.from < other.to && other.from < range.to)) continue;
    result.push({ ...item, ...range });
  }
  return result;
}

export function reviewTransaction(state: EditorState, action: ReviewAction) {
  return state.tr.setMeta(articleReviewKey, action).setMeta('addToHistory', false);
}

export function createArticleReviewPlugin(onChange?: (state: ReviewState) => void) {
  return new Plugin<ReviewState>({
    key: articleReviewKey,
    state: {
      init: () => empty,
      apply(tr, previous) {
        const action = tr.getMeta(articleReviewKey) as ReviewAction | undefined;
        let items = previous.items;
        if (action?.type === 'set') items = action.items;
        else if (tr.docChanged) items = items.flatMap(item => {
          const from = tr.mapping.mapResult(item.from, 1), to = tr.mapping.mapResult(item.to, -1);
          if (from.deletedAcross || to.deletedAcross || !safeRange(tr.doc, from.pos, to.pos, item.quote)) return [];
          return [{ ...item, from: from.pos, to: to.pos }];
        });
        if (action?.type === 'remove') items = items.filter(item => item.id !== action.id);
        const activeId = action?.type === 'select' ? action.id : action?.type === 'set' ? null : previous.activeId;
        if (items === previous.items && activeId === previous.activeId) return previous;
        return { items, activeId: items.some(item => item.id === activeId) ? activeId : null };
      },
    },
    props: {
      decorations(state) {
        const review = articleReviewKey.getState(state) || empty;
        return DecorationSet.create(state.doc, review.items.map(item => Decoration.inline(item.from, item.to, {
          class: `article-review-mark${review.activeId === item.id ? ' is-active' : ''}`,
          'data-review-id': item.id, role: 'button', tabindex: '0', 'aria-label': `查看建议：${item.quote.slice(0, 40)}`,
        })));
      },
      handleClick(view, position, event) {
        const target = typeof Element !== 'undefined' && event.target instanceof Element ? event.target.closest('[data-review-id]') : null;
        // A wrapped inline span has gaps between its line boxes. Resolve the editor
        // position too, so clicking the dashed underline/gap still opens its note.
        const id = target?.getAttribute('data-review-id') || articleReviewKey.getState(view.state)?.items.find(item => item.from <= position && position < item.to)?.id;
        if (!id) return false;
        view.dispatch(reviewTransaction(view.state, { type: 'select', id }));
        return true;
      },
      handleKeyDown(view, event) {
        if (event.key === 'Escape') { view.dispatch(reviewTransaction(view.state, { type: 'select', id: null })); return false; }
        if (event.key !== 'Enter' && event.key !== ' ') return false;
        const target = event.target instanceof Element ? event.target.closest('[data-review-id]') : null;
        if (!target) return false;
        event.preventDefault();
        view.dispatch(reviewTransaction(view.state, { type: 'select', id: target.getAttribute('data-review-id') }));
        return true;
      },
    },
    view: view => {
      const unregister = registerArticleReviewController(view, {
        clear: () => view.dispatch(reviewTransaction(view.state, { type: 'set', items: [] })),
        select(id, scroll) {
          const tr = reviewTransaction(view.state, { type: 'select', id });
          const item = articleReviewKey.getState(view.state)?.items.find(item => item.id === id);
          if (scroll && item) tr.setSelection(TextSelection.create(view.state.doc, item.from, item.to)).scrollIntoView();
          view.dispatch(tr);
        },
        locate: suggestions => locateArticleSuggestions(view.state.doc, suggestions),
        set: items => view.dispatch(reviewTransaction(view.state, { type: 'set', items })),
        adopt(id) {
          const tr = applyArticleSuggestion(view.state, id);
          if (!tr) return false;
          // Keep each choice separate from adjacent typing and other choices in undo history.
          view.dispatch(closeHistory(tr));
          view.dispatch(closeHistory(view.state.tr).setMeta('addToHistory', false));
          view.focus();
          return true;
        },
        dismiss(id) { view.dispatch(reviewTransaction(view.state, { type: 'remove', id })); view.focus(); },
      });
      return {
        update(view, previous) {
          const next = articleReviewKey.getState(view.state)!;
          if (next !== articleReviewKey.getState(previous)) onChange?.(next);
        },
        destroy: unregister,
      };
    },
  });
}

/** Apply just one choice in one undoable transaction, preserving untouched inline formatting. */
export function applyArticleSuggestion(state: EditorState, id: string): Transaction | null {
  const item = articleReviewKey.getState(state)?.items.find(item => item.id === id);
  if (!item || item.kind === 'clarify' || !safeRange(state.doc, item.from, item.to, item.quote)) return null;
  const tr = state.tr;
  if (item.kind === 'emphasis') {
    const mark = state.schema.marks[item.presentation];
    if (!mark) return null;
    tr.addMark(item.from, item.to, mark.create());
  } else {
    const replacement = item.replacement!;
    let prefix = 0, suffix = 0;
    while (prefix < item.quote.length && prefix < replacement.length && item.quote[prefix] === replacement[prefix]) prefix++;
    while (suffix < item.quote.length - prefix && suffix < replacement.length - prefix && item.quote[item.quote.length - 1 - suffix] === replacement[replacement.length - 1 - suffix]) suffix++;
    // Do not split a surrogate pair when calculating a minimal text change.
    if (prefix && /[\uD800-\uDBFF]/.test(item.quote[prefix - 1])) prefix--;
    if (suffix && /[\uDC00-\uDFFF]/.test(item.quote[item.quote.length - suffix])) suffix--;
    tr.setStoredMarks(null).insertText(replacement.slice(prefix, replacement.length - suffix), item.from + prefix, item.to - suffix);
  }
  return tr.setMeta(articleReviewKey, { type: 'remove', id } satisfies ReviewAction).scrollIntoView();
}

export function localReviewDemo(doc: DocumentNode): ArticleSuggestion[] {
  const result: ArticleSuggestion[] = [];
  doc.descendants((node) => {
    if (!node.isTextblock || node.type.name !== 'paragraph') return;
    const sentence = node.textContent.match(/[^。！？\n]{10,70}[。！？]/)?.[0];
    if (sentence && result.length < 2) result.push({ id: `review-${result.length + 1}`, kind: 'emphasis', quote: sentence, prefix: '', suffix: '', replacement: null,
      presentation: result.length ? 'highlight' : 'bold', reason: '本地交互示例：可以试着强调这句，只有点击“采用”才会改变正文。连接文字模型后会按全文给出实际建议。' });
  });
  return result;
}
