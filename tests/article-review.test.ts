import assert from 'node:assert/strict';
import { getArticleReviewController } from '../lib/article-review-client';
import { Schema } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { DecorationSet } from '@tiptap/pm/view';
import { closeHistory, history, undo } from '@tiptap/pm/history';
import { applyArticleSuggestion, articleReviewKey, createArticleReviewPlugin, locateArticleSuggestions, parseArticleSuggestions, reviewTransaction, type ArticleSuggestion } from '../lib/article-review';

const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, paragraph: { content: 'inline*', group: 'block' }, text: { group: 'inline' },
  codeBlock: { content: 'text*', group: 'block', code: true },
}, marks: { bold: {}, highlight: {}, link: { attrs: { href: {} } }, code: {} } });
const p = (text: string) => schema.node('paragraph', null, schema.text(text));
const suggestion = (quote: string, extra: Partial<ArticleSuggestion> = {}): ArticleSuggestion => ({ id: 'a', kind: 'replace', quote, prefix: '', suffix: '', replacement: '新的表达。', presentation: 'bold', reason: '让主体更清楚。', ...extra });
const doc = schema.node('doc', null, [p('开头。'), p('表达要很清晰。'), p('结尾保持原样。')]);
const initial = () => EditorState.create({ schema, doc, plugins: [history(), createArticleReviewPlugin()] });
function attach(state: EditorState, suggestions: ArticleSuggestion[]) {
  return state.apply(reviewTransaction(state, { type: 'set', items: locateArticleSuggestions(state.doc, suggestions) }));
}

let state = attach(initial(), [suggestion('表达要很清晰。')]);
assert.deepEqual(state.doc.toJSON(), doc.toJSON(), 'checking never changes the document');
assert.ok(!JSON.stringify(state.toJSON()).includes('review-'), 'review state is not document state');
const mark = articleReviewKey.getState(state)!.items[0];
const decorations = articleReviewKey.get(state)!.props.decorations!.call(articleReviewKey.get(state)!, state)!;
assert.ok(decorations instanceof DecorationSet);
assert.equal(decorations.find().length, 1, 'underline is a view decoration');
assert.ok(!JSON.stringify(state.doc.toJSON()).includes('data-review'), 'annotations cannot leak into saved/exported document JSON');
const plugin = articleReviewKey.get(state)!;
const clicked = plugin.props.handleClick!.call(plugin, { state, dispatch: (tr: Transaction) => { state = state.apply(tr); } } as never, mark.from + 2, { target: null } as never);
assert.equal(clicked, true);
assert.equal(articleReviewKey.getState(state)!.activeId, 'a', 'clicking an inter-line gap resolves the text position too');
state = state.apply(state.tr.insertText('新增前言。', 1));
assert.equal(articleReviewKey.getState(state)!.items[0].from, mark.from + '新增前言。'.length, 'typing before a suggestion maps its location');
const moved = articleReviewKey.getState(state)!.items[0];
state = state.apply(state.tr.insertText('改动', moved.from + 2));
assert.equal(articleReviewKey.getState(state)!.items.length, 0, 'editing the marked sentence invalidates its old suggestion');

const duplicates = schema.node('doc', null, [p('甲：同一句话。'), p('乙：同一句话。')]);
assert.equal(locateArticleSuggestions(duplicates, [suggestion('同一句话。')]).length, 0, 'ambiguous text is never guessed');
assert.equal(locateArticleSuggestions(duplicates, [suggestion('同一句话。', { prefix: '乙：' })]).length, 1);
assert.equal(locateArticleSuggestions(doc, [suggestion('不存在的原句')]).length, 0);
assert.equal(locateArticleSuggestions(doc, [suggestion('表达要很清晰。'), suggestion('很清晰', { id: 'b' })]).length, 1, 'overlapping proposals are not silently combined');

const protectedDoc = schema.node('doc', null, [schema.node('codeBlock', null, schema.text('不要改代码。')),
  schema.node('paragraph', null, schema.text('不要改链接。', [schema.mark('link', { href: 'https://example.com' })])),
  schema.node('paragraph', null, schema.text('不要改行内代码。', [schema.mark('code')]))]);
assert.equal(locateArticleSuggestions(protectedDoc, ['不要改代码。', '不要改链接。', '不要改行内代码。'].map(quote => suggestion(quote))).length, 0);

const richDoc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('表达要很'), schema.text('清晰', [schema.mark('bold')]), schema.text('。')]), p('另一句不动。')]);
state = attach(EditorState.create({ schema, doc: richDoc, plugins: [history(), createArticleReviewPlugin()] }),
  [suggestion('表达要很清晰。', { replacement: '表达要更清晰。' }), suggestion('另一句不动。', { id: 'b', kind: 'emphasis', replacement: null })]);
const beforeApply = state.doc;
const applied = applyArticleSuggestion(state, 'a')!;
state = state.apply(closeHistory(applied));
assert.equal(state.doc.firstChild!.textContent, '表达要更清晰。');
assert.ok(state.doc.firstChild!.child(1).marks.some(mark => mark.type.name === 'bold'), 'unchanged bold text retains its formatting');
assert.equal(state.doc.child(1).textContent, '另一句不动。');
assert.equal(articleReviewKey.getState(state)!.items.length, 1, 'one choice leaves other suggestions pending');
assert.equal(undo(state, tr => { state = state.apply(tr); }), true);
assert.ok(state.doc.eq(beforeApply), 'undo restores the exact pre-adoption document');

state = attach(initial(), [suggestion('表达要很清晰。', { kind: 'emphasis', replacement: null, presentation: 'highlight' })]);
assert.equal(state.doc.rangeHasMark(mark.from, mark.to, schema.marks.highlight), false);
state = state.apply(applyArticleSuggestion(state, 'a')!);
assert.equal(state.doc.textContent, doc.textContent);
assert.equal(state.doc.rangeHasMark(mark.from, mark.to, schema.marks.highlight), true, 'emphasis is added only after adoption');

state = attach(initial(), [suggestion('表达要很清晰。', { kind: 'clarify', replacement: null })]);
assert.equal(applyArticleSuggestion(state, 'a'), null, 'an unverified fact has no executable replacement');
const beforeIgnore = state.doc;
state = state.apply(reviewTransaction(state, { type: 'remove', id: 'a' }));
assert.ok(state.doc.eq(beforeIgnore), 'ignoring changes no content or formatting');

assert.throws(() => parseArticleSuggestions({ suggestions: '全文改稿' }));
assert.deepEqual(parseArticleSuggestions({ suggestions: [{ kind: 'move', quote: '原文', reason: '挪动' }, { kind: 'replace', quote: '原文', replacement: '跨\n段', reason: '改写' }] }), []);
const parsed = parseArticleSuggestions({ suggestions: [{ id: '<script>', kind: 'clarify', quote: '原文', replacement: '编造事实', reason: '请确认版本。' }] });
assert.equal(parsed[0].replacement, null);
assert.equal(parsed[0].id, 'review-1', 'model IDs do not become DOM attributes');
console.log('PASS: inline review anchoring, mapping, invalidation, isolated adoption, formatting, undo and non-persistent decorations');

// The first-page shell can control a mounted editor without importing ProseMirror.
let adapterState = initial();
let focusCount = 0;
const adapterView = {
  get state() { return adapterState; },
  dispatch(tr: Transaction) { adapterState = adapterState.apply(tr); },
  focus() { focusCount++; },
};
const adapterPlugin = articleReviewKey.get(adapterState)!;
const lifecycle = adapterPlugin.spec.view!(adapterView as never);
const controller = getArticleReviewController(adapterView)!;
assert.ok(controller, 'The plugin registers its controller before editor ready');
assert.equal(getArticleReviewController({}), undefined, 'Controllers are isolated by editor view');
controller.set(controller.locate([suggestion('表达要很清晰。')]));
controller.select('a', true);
assert.equal(articleReviewKey.getState(adapterState)?.activeId, 'a');
assert.equal(adapterState.selection.from, mark.from);
assert.equal(controller.adopt('a'), true);
assert.equal(adapterState.doc.child(1).textContent, '新的表达。');
assert.equal(focusCount, 1);
assert.ok(undo(adapterState, tr => { adapterState = adapterState.apply(tr); }));
assert.ok(adapterState.doc.eq(doc), 'Adapter adoption remains one undoable edit');
controller.set(controller.locate([suggestion('表达要很清晰。')]));
controller.dismiss('a');
assert.equal(articleReviewKey.getState(adapterState)?.items.length, 0);
assert.ok(adapterState.doc.eq(doc));
controller.set(controller.locate([suggestion('表达要很清晰。')]));
controller.clear();
assert.equal(articleReviewKey.getState(adapterState)?.items.length, 0);
lifecycle.destroy!();
assert.equal(getArticleReviewController(adapterView), undefined, 'Destroying the editor removes its controller');
console.log('PASS: deferred editor controller isolation, selection, adoption, undo and lifecycle cleanup');
