import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { markdownToWechat, escapeHtml, htmlToPlainText } from '../lib/wechat-html';
import { styles, getStyleComponentDefaults } from '../lib/styles';
import { auditWechatHtml } from '../lib/wechat-compliance';

const fixture = `# 回归标题

## 章节内容

### 小节内容

正文包含 **粗体词**、*斜体词*、~~删除词~~、==标记词== 和 \`inlineToken\`。
特殊字符：& < > " ' 中文 emoji 😀。

> 引用内容

- 列表甲
- 列表乙

1. 步骤甲
2. 步骤乙

\`\`\`js
const value = "<safe>&";
\`\`\`

| 名称 | 数据 |
| --- | --- |
| 表格甲 | 42 |

![图片说明](https://example.com/cover.png)

[链接文字](https://example.com/article)

:::lead
导语内容
:::

:::callout
重点内容
:::

:::tip
提示内容
:::

:::warn
提醒内容
:::

:::follow
card|关注标题|关注说明|关注按钮||https://example.com/follow
:::

:::recs
相关阅读标题｜https://example.com/rec.png｜https://example.com/rec
:::

:::author
作者名字|作者介绍
:::

:::divider
chapter|分隔标记
:::

:::compare
标题：方案比较
A｜方案甲｜成本低
B｜方案乙｜效果好
结论：选择方案甲
:::
`;

const baselinePath = join(__dirname, 'fixtures', 'wechat-baselines.json');
const hashes: Record<string, string> = {};
assert.equal(styles.length, 12, 'Protect every shipped style');
for (const style of styles) {
  const html = markdownToWechat(fixture, style.accent, '#fff07a', style.id, style.reading.padX, '', {
    ...style.reading, paper: style.paper, headingStyle: getStyleComponentDefaults(style.id).headingStyle,
  });
  const plain = htmlToPlainText(html);
  for (const text of ['回归标题', '章节内容', '小节内容', '粗体词', '斜体词', '删除词', '标记词', 'inlineToken', '引用内容', '列表甲', '列表乙', '步骤甲', '步骤乙', '表格甲', '42', '导语内容', '重点内容', '提示内容', '提醒内容', '关注标题', '相关阅读标题', '作者名字', '方案比较', '方案甲', '方案乙', '选择方案甲', '😀']) {
    assert.ok(plain.includes(text), `${style.id}: lost content ${text}`);
  }
  for (const tag of ['h1', 'h2', 'h3', 'strong', 'em', 'table', 'img', 'a']) {
    assert.match(html, new RegExp(`<${tag}\\b`), `${style.id}: missing ${tag}`);
  }
  assert.match(html, /&lt;safe&gt;&amp;/, `${style.id}: code must escape HTML`);
  assert.match(html, /src="https:\/\/example.com\/cover.png"/, `${style.id}: image source`);
  assert.match(html, /href="https:\/\/example.com\/article"/, `${style.id}: link destination`);
  assert.doesNotMatch(plain, /:::|\*\*|\| ---/, `${style.id}: raw Markdown leaked`);
  assert.equal(auditWechatHtml(html).length, 0, `${style.id}: WeChat typography compliance`);
  assert.equal(markdownToWechat(fixture, style.accent, '#fff07a', style.id, style.reading.padX, '', {
    ...style.reading, paper: style.paper, headingStyle: getStyleComponentDefaults(style.id).headingStyle,
  }), html, `${style.id}: rendering must be deterministic`);
  hashes[style.id] = createHash('sha256').update(html).digest('hex');
}
assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
assert.equal(htmlToPlainText('<p>A &amp; B</p><script>secret()</script><style>hidden</style><p>C<br>D</p>'), 'A & B\nC\nD');
assert.ok(markdownToWechat('', '#2563eb').length > 0, 'Empty article remains renderable');
const aliases = [['tip', 'callout'], ['recs', 'recommendations']] as const;
for (const [alias, canonical] of aliases) {
  const body = alias === 'tip' ? '别名内容' : '别名内容｜https://example.com/image.png｜https://example.com/a';
  assert.equal(markdownToWechat(`:::${alias}\n${body}\n:::`, '#2563eb'), markdownToWechat(`:::${canonical}\n${body}\n:::`, '#2563eb'));
}
for (const headingStyle of ['bar', 'frame', 'twin', 'markerHalf', 'markerUnder', 'markerLine', 'numberFrame', 'iconTag', 'avatarLeft', 'avatarTop', 'poster', 'brand']) {
  const html = markdownToWechat('# 标题\n\n## 章节\n\n### 小节', '#2563eb', '#fff07a', 'knowledge', 24, '', { headingStyle });
  assert.ok(htmlToPlainText(html).includes('章节'), `${headingStyle}: heading text`);
  assert.equal(auditWechatHtml(html).length, 0, `${headingStyle}: typography`);
}
for (const variant of ['克制', '视觉化']) {
  const html = markdownToWechat('正文内容', '#2563eb', '#fff07a', 'knowledge', 24, '', { variant, fontSize: 16, lineHeight: 1 });
  assert.equal(auditWechatHtml(html).length, 0, `${variant}: low line height is repaired`);
  assert.match(html, new RegExp(`font-size:${variant === '克制' ? 14 : 18}px`));
}
if (process.env.UPDATE_WECHAT_BASELINES === '1') {
  writeFileSync(baselinePath, `${JSON.stringify(hashes, null, 2)}\n`);
  console.log('Updated output baselines after semantic assertions passed');
} else {
  assert.deepEqual(hashes, JSON.parse(readFileSync(baselinePath, 'utf8')), 'Rendering changed: review HTML behavior before updating baselines');
}
console.log('PASS: 12 styles, Markdown content, custom blocks, escaping, plain text, aliases and output baselines');
