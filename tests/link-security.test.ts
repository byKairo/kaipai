import assert from 'node:assert/strict';
import { markdownToWechat } from '../lib/wechat-html';
import { safeArticleLink } from '../lib/article-link';
import { styles } from '../lib/styles';

const blocked = ['javascript:alert`1`', 'JaVaScRiPt:alert`1`', '  javascript:alert`1`  ', 'java\tscript:alert`1`', 'java\rscript:alert`1`', 'data:text/html,<script>alert`1`</script>', 'vbscript:msgbox`1`', 'blob:https://example.com/id', 'file:///tmp/key'];
for (const target of blocked) assert.equal(safeArticleLink(target), null, target);
const safe = ['https://example.com/article?a=1&b=2', 'http://example.com/', 'mailto:author@example.com', 'tel:+8612345678', '/help', '#section', '../article'];
for (const target of safe) assert.equal(safeArticleLink(target), target);

for (const style of styles) {
  const render = (text: string) => markdownToWechat(text, style.accent, '#fff07a', style.id);
  for (const target of blocked.filter(value => !/[\r\n]/.test(value))) {
    const link = `[阅读说明](${target})`;
    for (const input of [link, `> ${link}`, `:::follow\nminimal|标题|${link}|关注\n:::`, `:::recs\n${link}\n:::`, `| 标题 | 内容 |\n| --- | --- |\n| 信息 | ${link} |`]) {
      const html = render(input);
      assert.doesNotMatch(html, /<a\b/i, `${style.id}: unsafe link must become text: ${target}`);
      assert.ok(html.includes('阅读说明'), 'Keep the label');
      assert.doesNotMatch(html, /<script\b/i);
    }
  }
  const html = render('**[阅读说明](https://example.com/article?a=1&b=2)** 和 [**重点**](mailto:author@example.com)');
  assert.match(html, /<strong[^>]*><a href="https:\/\/example.com\/article\?a=1&amp;b=2"/);
  assert.match(html, /href="mailto:author@example.com"[^>]*><strong[^>]*>重点<\/strong>/);
  assert.doesNotMatch(html, /kaipai-link-/);
  // Destination punctuation must not become generated markup inside an attribute.
  const quoted = render('[查看](https://example.com/**bold**?q="value"&x=1)');
  assert.match(quoted, /href="https:\/\/example.com\/\*\*bold\*\*\?q=&quot;value&quot;&amp;x=1"/);
  assert.doesNotMatch(quoted, /href="[^\n]*<strong/);
  const entities = render('[说明](java&#x73;cript:alert`1`)');
  assert.match(entities, /href="java&amp;#x73;cript:alert`1`"/); // One attribute decode stays literal, not a JS scheme.
}
console.log('Article link protocol security and legitimate formatting passed');
