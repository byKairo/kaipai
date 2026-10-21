import assert from 'node:assert/strict';
import { Schema } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { captureImageTarget, isImageTargetCurrent, scopedImageBriefs, imageScopePreference } from '../lib/ai-workbench';

const schema = new Schema({ nodes: {
  doc: { content: 'block+' }, text: { group: 'inline' },
  paragraph: { content: 'inline*', group: 'block' },
  bulletList: { content: 'listItem+', group: 'block' },
  listItem: { content: 'paragraph+' },
} });
const p = (text: string) => schema.node('paragraph', null, text ? schema.text(text) : undefined);
const first = p('第一段');
const second = p('第二段');
const doc = schema.node('doc', null, [first, second]);
const target = captureImageTarget(doc, TextSelection.create(doc, 2), 'a')!;
assert.equal(target.text, '第一段', 'cursor targets its paragraph, rather than the whole article');
assert.equal(target.insertAt, first.nodeSize, 'image goes after the paragraph');
assert.equal(isImageTargetCurrent(doc, target, 'a'), true);
assert.equal(isImageTargetCurrent(doc, target, 'b'), false, 'same text in another article must never receive the image');
assert.equal(isImageTargetCurrent(schema.node('doc', null, [p('新第一段'), second]), target, 'a'), false);
assert.equal(isImageTargetCurrent(schema.node('doc', null, [first, p('改二段')]), target, 'a'), false, 'other edits invalidate stored positions too');
const selected = captureImageTarget(doc, TextSelection.create(doc, 2, 3), 'a')!;
assert.equal(selected.text, '一');
assert.equal(selected.insertAt, first.nodeSize, 'partial selection must not split a paragraph');
const multi = captureImageTarget(doc, TextSelection.create(doc, 2, first.nodeSize + 2), 'a')!;
assert.equal(multi.insertAt, doc.content.size, 'multiple selected paragraphs insert after the last block');
const list = schema.node('bulletList', null, [schema.node('listItem', null, [p('列表项')])]);
const listDoc = schema.node('doc', null, [list, second]);
assert.equal(captureImageTarget(listDoc, TextSelection.create(listDoc, 4), 'a')?.insertAt, list.nodeSize, 'list image must not land inside a list item');
const emptyDoc = schema.node('doc', null, [p('')]);
assert.equal(captureImageTarget(emptyDoc, TextSelection.create(emptyDoc, 1), 'a'), undefined);
const briefs = ['正文｜解释关键关系', '封面｜呈现文章主题', '正文｜第二个解释'];
assert.deepEqual(scopedImageBriefs(briefs, 'cover'), ['封面｜呈现文章主题']);
assert.deepEqual(scopedImageBriefs(briefs, 'selection', target), ['正文｜解释关键关系']);
assert.deepEqual(scopedImageBriefs(briefs, 'article'), ['正文｜解释关键关系', '正文｜第二个解释'], 'Covers must use the dedicated reviewed cover workflow');
assert.ok(scopedImageBriefs(['封面｜主题'], 'article')[0].startsWith('正文｜'), 'A legacy image plan cannot bypass cover review');
assert.ok(scopedImageBriefs(['封面｜主题'], 'selection', target)[0].includes('第一段'), 'wrong-purpose model output falls back to the requested paragraph');
assert.ok(imageScopePreference('selection', target).includes('第一段'));
console.log('PASS: image purpose filtering, paragraph/list placement and stale article guards');
