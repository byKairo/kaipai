import assert from 'node:assert/strict';
import { markdownToWechat, htmlToPlainText } from '../lib/wechat-html';
import { findStyle } from '../lib/styles';
import { auditWechatHtml } from '../lib/wechat-compliance';
import { COMPARISON_SAMPLE, COMPARISON_STYLE_IDS } from '../lib/article-styles/comparison-sample';

const render = (id: string, md: string) => {
  const s = findStyle(id);
  return markdownToWechat(md, '#222222', '#eeeeee', id, s.reading.padX, '', { ...s.reading, paper: '#ffffff' });
};
// Track block ancestry to verify that complete answers stay inside their own question.
function blockAncestry(html: string, signature = 'border-top:4px solid') {
  const stack: { tag: string; key: number; question: boolean }[] = [];
  const text: { value: string; question?: number }[] = [];
  let key = 0;
  for (const token of html.match(/<[^>]*>|[^<]+/g) || []) {
    const close = token.match(/^<\/(\w+)/);
    if (close) {
      assert.equal(stack.pop()?.tag, close[1], 'Exported block nesting must remain balanced');
    } else if (token.startsWith('<')) {
      const tag = token.match(/^<(\w+)/)?.[1];
      if (tag && !['img', 'br', 'hr'].includes(tag)) stack.push({ tag, key: key++, question: tag === 'section' && token.includes(signature) });
    } else {
      text.push({ value: token, question: stack.find(item => item.question)?.key });
    }
  }
  assert.equal(stack.length, 0);
  return text;
}
const fixture = '# 总标题\n\n开头段落\n\n## 第一问题\n\n第一解释\n\n- 第一列表\n\n![第一图注](https://example.com/a.jpg)\n\n## 第二问题\n\n第二解释\n\n| 项目 | 数据 |\n| --- | --- |\n| 第二表格 | 数值 |\n\n[^1]: 文末来源';
const qa = blockAncestry(render('edu', fixture));
const scope = (value: string) => qa.find(item => item.value.includes(value))?.question;
assert.notEqual(scope('第一问题'), undefined);
assert.equal(scope('第一问题'), scope('第一解释'));
assert.equal(scope('第一问题'), scope('第一列表'));
assert.equal(scope('第一问题'), scope('第一图注'));
assert.equal(scope('第二问题'), scope('第二表格'));
assert.notEqual(scope('第一问题'), scope('第二问题'));
assert.equal(scope('开头段落'), undefined);
assert.equal(scope('文末来源'), undefined);
const endMatter = blockAncestry(render('edu', '## 问题\n\n正文\n\n:::author\n独立署名\n:::'));
assert.equal(endMatter.find(item => item.value.includes('独立署名'))?.question, undefined, 'Author belongs to article, not final answer');
assert.doesNotMatch(render('edu', '没有小标题的文章'), /border-top:4px solid/, 'No empty question cards');
blockAncestry(render('edu', '## 问题\n\n```txt\n未闭合的代码'));
blockAncestry(render('edu', '## 问题\n\n内容\n\n# 新标题\n\n尾部正文'));

for (const id of COMPARISON_STYLE_IDS) {
  const html = render(id, COMPARISON_SAMPLE);
  assert.equal(auditWechatHtml(html).length, 0);
  blockAncestry(html);
  const plain = htmlToPlainText(html);
  let previous = -1;
  for (const content of ['把一盏灯，留给夜晚', '林舟习惯在晚上工作', '为什么要把光收回来', '好的设计，是让人更愿意停留', '怎样让调节更顺手', '旋转灯臂', '最后留下了什么', '可调节的转轴', '这一次，他愿意再坐一会儿']) {
    const position = plain.indexOf(content);
    assert.ok(position > previous, id + ': retain original content order: ' + content);
    previous = position;
  }
  assert.equal((html.match(/<img /g) || []).length, 1, 'Preserve original image count');
  assert.doesNotMatch(plain, /品牌宣言|审核专家|人物专访|阅读量/,'Do not invent article metadata');
}
const portrait = render('editorial', '> 引语');
assert.doesNotMatch(portrait.match(/<blockquote[^>]*>/)?.[0] || '', /border:/, 'Narrative quote is not a card');
assert.match(render('corp', fixture), /font-size:42px/, 'Product chapters retain a large number even in monochrome');
assert.match(render('edu', fixture), /border-top:4px solid/, 'Question grouping does not depend on color');
// Tutorial steps and comic scenes must keep complete blocks and exclude end matter.
for (const [id, signature] of [['tech', 'border-left:2px solid'], ['boldneo', 'margin:28px 0;padding:16px 14px 4px;border:3px solid']] as const) {
  const blocks = blockAncestry(render(id, fixture + '\n\n:::author\n独立署名\n:::'), signature);
  const group = (text: string) => blocks.find(item => item.value.includes(text))?.question;
  assert.notEqual(group('第一问题'), undefined, id + ': section opened');
  assert.equal(group('第一问题'), group('第一解释'));
  assert.equal(group('第一问题'), group('第一图注'));
  assert.equal(group('第一问题'), group('第一列表'));
  assert.equal(group('第二问题'), group('第二表格'));
  assert.notEqual(group('第一问题'), group('第二问题'));
  assert.equal(group('独立署名'), undefined);
  assert.equal(group('文末来源'), undefined);
  blockAncestry(render(id, '## 章\n\n```txt\n未闭合的代码'), signature);
  assert.doesNotMatch(render(id, '纯正文，不强行增加步骤或分镜。'), new RegExp(signature));
}
const poetry = render('festival', '灯亮着。\n\n' + '这是需要连续阅读的长段落。'.repeat(7));
assert.match(poetry, /<p[^>]*text-align:center[^>]*>灯亮着。/);
assert.match(poetry, /<p[^>]*text-align:left[^>]*>这是需要连续阅读/);
const dialogue = render('boldneo', '> 原话一\n\n> 原话二\n\n> 原话三');
const bubbles = Array.from(dialogue.matchAll(/<blockquote([^>]*)>(.*?)<\/blockquote>/g));
assert.equal(bubbles.length, 3);
assert.match(bubbles[0][1], /margin:24px auto 24px 0/);
assert.match(bubbles[1][1], /margin:24px 0 24px auto/);
assert.match(bubbles[2][1], /margin:24px auto 24px 0/);
assert.ok(bubbles.every((bubble, i) => bubble[2] === ['原话一', '原话二', '原话三'][i]), 'No invented dialogue speaker or content');
const photos = render('event', '![原图一](https://example.com/one.jpg)\n\n![原图二](https://example.com/two.jpg)');
assert.match(htmlToPlainText(photos), /01 \/ 原图一/);
assert.match(htmlToPlainText(photos), /02 \/ 原图二/);
assert.doesNotMatch(photos, /FRAME|CONTACT|width:94%/);
assert.doesNotMatch(render('event', '没有图片的文章'), /<img/);
assert.match(render('business', '正文'), /font-size:15px[^>]*margin:0 0 16px/);
assert.match(render('pixelpost', '正文'), /font-size:17px[^>]*margin:0 0 28px/);
assert.match(render('opinion', '正文'), /<p[^>]*border-bottom:1px dashed/);
assert.match(render('knowledge', '# 标题'), /<h1[^>]*font-family:'Songti SC'[^>]*border:0/);
assert.match(render('knowledge', '## 章节'), /width:36px[^>]*border-bottom:2px solid/, 'Column uses a short chapter anchor, not a full-width frame');
assert.match(render('research', fixture), /<table[^>]*border-top:2px solid[^>]*border-bottom:2px solid/);
console.log('PASS: all 12 styles preserve content; complete step/scene/question grouping, poetry alignment, dialogue alternation and original images');
