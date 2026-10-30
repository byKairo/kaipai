/** Fictional design specimen. Never substituted into the user's article. */
export const COMPARISON_GROUPS = [
  { name: '长读与诗页', ids: ['knowledge', 'pixelpost', 'festival'] },
  { name: '教程与笔记', ids: ['tech', 'opinion', 'boldneo'] },
  { name: '报告与影像', ids: ['business', 'research', 'event'] },
  { name: '首批三套', ids: ['editorial', 'edu', 'corp'] },
] as const;
export const COMPARISON_STYLE_IDS = COMPARISON_GROUPS.flatMap(group => [...group.ids]);
export const COMPARISON_SAMPLE = `# 把一盏灯，留给夜晚

:::lead
一位设计师、一张书桌，以及一束恰好落在书页上的光。我们从三个问题，看看一件日常物品如何被重新设计。
:::

**林舟习惯在晚上工作。**窗外的声音渐渐安静下来，他把桌上的物品逐件挪开，只留下一本书和一盏灯。

==“我希望它照亮眼前的事，也给房间留一点暗。”==他说。这个念头，成了这次设计的起点。

![灯光落在书页上，周围仍保留安静的暗部。](/article-assets/lamp-study.svg)

灯亮着。

书页慢慢翻过。

## 为什么要把光收回来？

最初的样品把整张桌子照得很亮。但坐下来读书时，视线反而容易被周围的东西带走。

林舟把灯罩向下收拢，让光落在真正需要的位置。改变并不显眼，坐在桌前的感受却不同了。

> 好的设计，是让人更愿意停留。

## 怎样让调节更顺手？

他反复调整灯臂的转轴，让角度变化只需要一个动作。底座保持稳定，手可以自然地停在旋钮上。

- 旋转灯臂，让光落在书页中央。
- 调整亮度，找到适合当下的光线。
- 留出桌面空间，让常用物品触手可及。

> 让动作简单一点，让注意力留给眼前。

:::callout
先从实际使用的动作出发，再决定产品的形状。
:::

## 最后留下了什么？

样品没有增加更多按钮。设计师保留了三个可以被直接感知的细节：向下的光线、顺手的调节和稳定的支撑。

| 部位 | 设计选择 |
| --- | --- |
| 灯罩 | 向下收拢的轮廓 |
| 灯臂 | 可调节的转轴 |
| 底座 | 简洁、稳定的支撑 |

夜深了，林舟把笔放回原处。桌上仍然只有一本书和一盏灯，这一次，他愿意再坐一会儿。
`;
