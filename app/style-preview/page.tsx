'use client';
import { styleUseCases } from '../../lib/article-styles/visual-rules';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { findStyle, getStyleComponentDefaults, newStyles } from '../../lib/styles';
import { markdownToWechat } from '../../lib/wechat-html';
import { COMPARISON_SAMPLE } from '../../lib/article-styles/comparison-sample';
import css from '../style-preview.module.css';

const COMPARISON_GROUPS = [
 {name:'长读与留白',ids:['v4-editorial','v4-night','v4-minimal']},
 {name:'手记与文化',ids:['v4-journal','v4-morandi','v4-cinnabar']},
 {name:'教程与简报',ids:['v4-blueprint','v4-corporate','v4-book']},
 {name:'强视觉',ids:['v4-brutal','v4-magazine','v4-comic']},
];
const LONG_SAMPLE = '# 那些值得慢慢读完的日常\n\n' + Array.from({length:8},(_,i)=>'## '+(i+1)+' · 把时间留给眼前\n\n'+('清晨走进那条街时，店铺还没有全部开门。有人把椅子搬到门口，有人低头整理昨天留下的报纸。我站了一会儿，才发现自己已经很久没有认真看过这些平常的事情。\n\n').repeat(4)+'> 引用也需要连续阅读。'+('文字应该清楚，停顿应该自然，边框只帮助辨认来源。').repeat(8)+'\n> 第二段引用保留在同一个引用区块里。\n\n').join('');
const STRESS_SAMPLE = '# 当文章标题很长时，十二种风格能否继续保持清楚、舒适与完整的阅读节奏？\n\n## 一个包含中文、English 与数字 2026 的长章节标题\n\n长链接：https://example.com/'+ 'readability'.repeat(20)+'\n\n> '+ '这是一段用来检查窄屏连续阅读的长引用。'.repeat(16)+'\n> 第二行引用内容。\n\n| 项目与评估范围 | 本期完成情况 | 上期对照 | 后续行动与负责人 | 预计交付时间 |\n| --- | --- | --- | --- | --- |\n| 阅读体验验证 | 已完成第一轮检查 | 持续跟进 | 编辑团队复核长文样稿 | 2026.11.01 |\n\n```js\nconst readableLayout = renderArticle({ title: "Long title", preserveStyle: true, viewport: 320, horizontalScroll: "available" });\n```\n\n表格和代码之后的正文必须完整保留。';
export default function StylePreview() {
  const [group, setGroup] = useState(0);
  const [sample,setSample] = useState('components');
  const [width,setWidth] = useState(440);
  const [monochrome, setMonochrome] = useState(false);
  const articles = useMemo(() => newStyles.map(style => {
    const id = style.id;
    return { style, html: markdownToWechat(sample==='long'?LONG_SAMPLE:sample==='stress'?STRESS_SAMPLE:COMPARISON_SAMPLE, style.accent, undefined, id, style.reading.padX, '', {
      ...style.reading, paper: style.paper, headingStyle: getStyleComponentDefaults(id).headingStyle,
    }) };
  }), [sample]);
  return <main className={css.page}>
    <header className={css.header}>
      <Link href="/" className={css.logo}>楷排<span>文章风格试阅</span></Link>
      <Link href="/" className={css.button}>返回工作台 ↗</Link>
    </header>
    <section className={css.intro}>
      <span className={css.tag}>12 套文章风格</span>
      <h1>同一篇文章，十二种阅读节奏。</h1>
      <p>十二套新版共用正式预览与导出渲染。切换样稿和文章宽度，检查长文、长引用、表格和代码。</p>
      <div className={css.controls}>
        <button className={css.button} aria-pressed={monochrome} onClick={() => setMonochrome(!monochrome)}>{monochrome ? '✓ 黑白对照' : '黑白对照'}</button>
        <label>样稿 <select aria-label="测试样稿" value={sample} onChange={e=>setSample(e.target.value)}><option value="components">组件样稿</option><option value="long">长文与长引用</option><option value="stress">长标题与宽内容</option></select></label>
        <label>文章宽度 <select aria-label="文章宽度" value={width} onChange={e=>setWidth(Number(e.target.value))}><option value={320}>320px</option><option value={375}>375px</option><option value={440}>440px</option><option value={677}>677px</option></select></label>
      </div>
    </section>
    <nav className={css.groups} aria-label="选择风格对照组">
      {COMPARISON_GROUPS.map((item, index) => <button key={item.name} className={css.button} aria-pressed={group === index} onClick={() => setGroup(index)}>{item.name}<span>{item.ids.map(id => findStyle(id).name).join(' / ')}</span></button>)}
    </nav>
    <section className={css.grid} style={{gridTemplateColumns:`repeat(auto-fit,minmax(min(100%,${width}px),${width}px))`,justifyContent:'center'}} aria-label={`${COMPARISON_GROUPS[group].name}风格对照`}>
      {articles.filter(({style}) => (COMPARISON_GROUPS[group].ids as readonly string[]).includes(style.id)).map(({ style, html }, index) => <section className={css.column} key={style.id}>
        <header className={css.columnHeader}>
          <span className={css.index}>0{index + 1}</span>
          <div><h2>{style.name}</h2><p>{style.preset?.u || styleUseCases[style.design].purpose}</p></div>
        </header>
        <p className={css.features}>{style.grammar}</p>
        <article aria-label={`${style.name}样稿`} className={css.article} style={{ width, maxWidth:'100%', margin:'0 auto', filter: monochrome ? 'grayscale(1)' : undefined }} dangerouslySetInnerHTML={{ __html: html }} />
      </section>)}
    </section>
    <footer className={css.footer}>虚构样稿与示意插画，仅用于比较版式。全部样式已加入工作台原有风格列表，切换不会改写正文。</footer>
  </main>;
}
