/**
 * Lightweight WeChat compliance smoke (no puppeteer).
 * Run: npm test (offline)
 */
import { markdownToWechat } from '../lib/wechat-html';
import { auditWechatHtml, enforceWechatCompliance } from '../lib/wechat-compliance';
import { findStyle, getStyleComponentDefaults, styles } from '../lib/styles';
import { wechatMinLineHeight } from '../lib/wechat-typography';

const FIXTURE = `# Soft NEO Wiki 合规样例

:::lead
这是导语：多行文字用来验证行高不低于字号，避免公众号「行高异常」。
第二行继续说明层级与节奏。
:::

## 章节标题 SECTION 验证

正文段落，包含 **加粗**、*斜体*、~~删除~~、==荧光== 与 \`inline code\`。

### 三级小标题

- 无序列表一项
- 无序列表二项含 **重点**

1. 有序第一步
2. 有序第二步

\`\`\`js
function hello(name) {
  return 'hi ' + name;
}
\`\`\`

| 列A | 列B | 列C |
| --- | --- | --- |
| 1 | 数据 | 说明 |
| 2 | 更多 | 对照 |

:::tip
重点卡内容，两行验证。
第二行仍在卡片内。
:::

:::warn
提醒卡：限制与风险。
:::

:::recs
相关阅读｜sample://cover｜https://example.com/a
另一篇｜sample://cover｜https://example.com/b
:::

:::follow
neo|关注楷排|持续分享真正有用的内容|关注公众号
:::
`;

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const stylesToTest = styles.map(style=>style.id);

let failed = 0;
for (const styleId of stylesToTest) {
  const style = findStyle(styleId);
  const skin = getStyleComponentDefaults(styleId);
  const html = markdownToWechat(
    FIXTURE,
    style.accent,
    '#fff07a',
    styleId,
    style.reading.padX,
    '',
    {
      fontSize: style.reading.fontSize,
      lineHeight: style.reading.lineHeight,
      paragraphGap: 16,
      imageRadius: style.reading.imageRadius,
      paper: style.paper,
      headingStyle: skin.headingStyle || 'bar',
    },
  );

  const gated = enforceWechatCompliance(html);
  const violations = auditWechatHtml(gated.html);
  const ok = gated.ok && violations.length === 0;

  // Spec 4.2.1: paper and descendant text share one background container.
  // Inspect the actual article shell, not incidental tables in the article.
  const paperShell=gated.html.match(/^<section style="([^"]+)"/i)?.[1] || '';
  const paperOk=paperShell.includes(`background-color:${style.paper}`)
    && /font-size:\s*\d+px/.test(paperShell) && /line-height:\s*\d+px/.test(paperShell);

  // Spot-check: no unitless LH left
  const unitless = /line-height:\s*\d+(?:\.\d+)?(?!px)/i.test(gated.html.replace(/line-height:\s*\d+(?:\.\d+)?px/gi, ''));

  console.log(
    `[${styleId}] audit=${violations.length} ok=${ok} paperShell=${paperOk} unitless residual scan=${unitless} repaired=${gated.repaired}`,
  );
  if (violations[0]) {
    console.log('  first:', violations[0].index, violations[0].tag, violations[0].reason, violations[0].message);
  }
  if (!ok || !paperOk || unitless) failed += 1;
}

// Primitive sanity
assert(wechatMinLineHeight(16) === 29, 'min lh 16');
assert(wechatMinLineHeight(11) === 21, 'min lh 11');
assert(wechatMinLineHeight(24) === 44, 'min lh 24');

if (failed) {
  console.error(`FAIL: ${failed} style(s)`);
  process.exit(1);
}
console.log('PASS: all styles audit clean');
