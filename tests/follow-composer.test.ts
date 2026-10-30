import assert from 'node:assert/strict';
import { buildFollowBlock, appendFollowBlock } from '../lib/follow-composer';
import { markdownToWechat } from '../lib/wechat-html';
export function run() {
  const block = buildFollowBlock('minimal', ['我的栏目','介绍|补充\n下一行','阅读更多','','https://example.com'], ['名称','说明','关注']);
  assert.equal(block, ':::follow\nminimal|我的栏目|介绍／补充 下一行|阅读更多||https://example.com\n:::');
  const original = '# 原文\n\n作者已有的判断与引用。\n\n:::follow\nminimal|旧署名|保留|关注||\n:::';
  const output = appendFollowBlock(original, block);
  assert.ok(output.startsWith(original+'\n\n'), 'Appending must not replace an existing author block or prose');
  assert.equal(appendFollowBlock('',block),block+'\n');
  const html=markdownToWechat(block,'#b3261e',undefined,'v4-editorial');
  assert.ok(html.includes('我的栏目'));
  assert.ok(html.includes('https://example.com'));
  console.log('PASS follow composer: field boundaries, original preservation, empty article and rendered content');
}
