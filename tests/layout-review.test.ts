import assert from 'node:assert/strict';
import { parseLayoutReview, prepareLayoutReview, previewLayout, locateAnchor, excludeIgnored, suggestionSignature, type LayoutSuggestion } from '../lib/layout-review';
const source = '开场。\n\n第一句。第二句。\n\n结论值得记住。';
const s = (kind: LayoutSuggestion['kind'], quote: string, proposal: string | null, extra = {}): LayoutSuggestion => ({id:'s1',kind,anchor:{quote},proposal,reason:'改善阅读。',depends_on:[],conflicts_with:[],...extra});
const review = (suggestions: LayoutSuggestion[], text = source) => parseLayoutReview({summary:'保持作者声音。',keep:[],suggestions}, text);
export function run() {
 const split = s('split','第一句。第二句。','第一句。\n\n第二句。');
 const emphasis = s('emphasis','结论值得记住。',null,{id:'s2',presentation:'highlight'});
 const valid = review([split,emphasis]);
 assert.equal(previewLayout(source,valid.suggestions,['s1','s2']), '开场。\n\n第一句。\n\n第二句。\n\n==结论值得记住。==');
 assert.equal(previewLayout(source,valid.suggestions,[]), source);
 assert.throws(()=> review([s('split','第一句。第二句。','改写。')]));
 assert.throws(()=> review([s('replace','不存在','伪造')]));
 assert.throws(()=> parseLayoutReview({formattedMarkdown:source},source));
 assert.throws(()=> locateAnchor('重复。重复。',{quote:'重复。'}));
 assert.deepEqual(locateAnchor('甲重复。乙重复。',{quote:'重复。',prefix:'乙'}),{from:5,to:8});
 assert.throws(()=> review([s('replace','const a = 1','const a = 2')],'```js\nconst a = 1\n```'));
 assert.throws(()=> review([s('replace','[网站](https://example.com)','网站')],'[网站](https://example.com)'));
 assert.throws(()=> review([s('replace','使用 `code`。','使用新代码。')],'使用 `code`。'));
 const move=s('move','结论值得记住。',null,{move_target:{anchor:{quote:'开场。'},placement:'before'}});
 assert.equal(previewLayout(source,review([move]).suggestions,['s1']).trim(), '结论值得记住。\n\n开场。\n\n第一句。第二句。');
 const overlap=s('emphasis','第一句。',null,{id:'s2',presentation:'bold'});
 assert.throws(()=>previewLayout(source,review([split,overlap]).suggestions,['s1','s2']));
 assert.throws(()=>previewLayout(source,review([split,{...emphasis,depends_on:['s1']}]).suggestions,['s2']));
 assert.throws(()=>review([{...split,depends_on:['s2']},{...emphasis,depends_on:['s1']}]));
 assert.throws(()=>review([s('clarify','开场。','编造事实')]));
 console.log('PASS anchored full-article layout: exact edits, preservation, structure, emphasis, ambiguity, overlap, dependencies, protected content, invalid response');
}

const small = '标题\n\n甲。\n\n乙。';
assert.equal(previewLayout(small, review([s('heading','标题','# 标题')],small).suggestions,['s1']), '# 标题\n\n甲。\n\n乙。');
assert.equal(previewLayout(small, review([s('merge','甲。\n\n乙。','甲。乙。')],small).suggestions,['s1']), '标题\n\n甲。乙。');
assert.equal(previewLayout(small, review([s('delete','乙。','')],small).suggestions,['s1']).trim(), '标题\n\n甲。');
assert.throws(()=>previewLayout(source,[s('clarify','开场。',null)],['s1']));
assert.throws(()=>review([s('emphasis','code',null,{presentation:'highlight'})],'使用 `code`。'));
assert.throws(()=>review([s('replace','网站','别的网站')],'[网站](https://example.com)'));

const rejected = s('replace', '开场。', '开头。');
const dependent = s('emphasis', '结论值得记住。', null, {id:'s2', presentation:'highlight', depends_on:['s1']});
assert.equal(excludeIgnored(review([rejected,dependent]), new Set([suggestionSignature(rejected)])).suggestions.length,0);

const splitThenMark = review([s('split','第一句。第二句。','第一句。\n\n第二句。'), s('emphasis','第一句。',null,{id:'s2',presentation:'highlight',depends_on:['s1']})]);
assert.equal(previewLayout(source,splitThenMark.suggestions,['s2','s1']), '开场。\n\n==第一句。==\n\n第二句。\n\n结论值得记住。');
const changedAnchor = review([s('replace','第一句。第二句。','另一句。'),s('emphasis','第一句。',null,{id:'s2',presentation:'highlight',depends_on:['s1']})]);
assert.throws(()=>previewLayout(source,changedAnchor.suggestions,['s1','s2']), /无法唯一定位/);

assert.throws(() => review([s('heading', '标题', '# 改写标题')], small), /AI 标题建议 s1.*改写了标题文字或格式.*这不是原文标题错误/);
assert.throws(() => review([s('heading', '标题', '#### 标题')], small), /不是单行一至三级/);
assert.throws(() => review([s('heading', '第一句。', '# 第一句。')]), /不是完整段落/);

// A malformed AI heading must not block independent valid edits or alter numbering.
const numbered = '## 05｜局部组件只在真正需要时出现\n\n结论值得记住。';
const badHeading = s('heading', '## 05｜局部组件只在真正需要时出现', '## 局部组件只在真正需要时出现');
const goodMark = s('emphasis', '结论值得记住。', null, { id: 's2', presentation: 'highlight' });
const prepare = (items: LayoutSuggestion[]) => prepareLayoutReview({ summary: '审阅结果', keep: [], suggestions: items }, numbered);
const partial = prepare([badHeading, goodMark]);
assert.deepEqual(partial.suggestions.map(s => s.id), ['s2']);
assert.equal(partial.rejected?.length, 1);
assert.equal(previewLayout(numbered, partial.suggestions, ['s2']), numbered.replace('结论值得记住。', '==结论值得记住。=='));
assert.equal(prepare([badHeading]).suggestions.length, 0);
assert.equal(prepare([badHeading]).rejected?.length, 1);
assert.equal(prepare([badHeading, { ...goodMark, depends_on: ['s1'] }]).suggestions.length, 0);
assert.equal(prepare([badHeading, { ...goodMark, conflicts_with: ['s1'] }]).suggestions[0].conflicts_with.length, 0);
assert.equal(prepare([goodMark, goodMark]).suggestions.length, 0);
assert.equal(prepare([{ ...goodMark, depends_on: ['missing'] }]).suggestions.length, 0);
assert.equal(prepare([{ ...goodMark, depends_on: ['s3'] }, { ...goodMark, id: 's3', depends_on: ['s2'] }]).suggestions.length, 0);
assert.throws(() => prepareLayoutReview({ summary: 'test', keep: [], suggestions: null }, numbered));
assert.throws(() => prepareLayoutReview(null, numbered));
assert.equal(prepare([s('heading', badHeading.anchor.quote, '### 05｜局部组件只在真正需要时出现')]).suggestions.length, 1);
