'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { findStyle, getStyleComponentDefaults } from '../../lib/styles';
import { markdownToWechat } from '../../lib/wechat-html';
import { COMPARISON_SAMPLE, COMPARISON_STYLE_IDS, COMPARISON_GROUPS } from '../../lib/article-styles/comparison-sample';
import css from '../style-preview.module.css';

const descriptions: Record<string, string> = {
  knowledge: '有观点，也有连续阅读的节奏',
  pixelpost: '给安静的文字留出呼吸',
  festival: '短句停顿，长段落自然阅读',
  tech: '沿着步骤，一次完成一个动作',
  opinion: '把零散想法收进笔记页',
  boldneo: '分镜叙述，让已有引语展开对话',
  business: '先看结论，再看取舍和行动',
  research: '区分解释、图表与证据',
  event: '照片展开，文字退后一步', 
  editorial: '像读一篇人物特写',
  edu: '一个问题，一个完整解释',
  corp: '让图片和细节成为主角',
};

export default function StylePreview() {
  const [group, setGroup] = useState(0);
  const [monochrome, setMonochrome] = useState(false);
  const articles = useMemo(() => COMPARISON_STYLE_IDS.map(id => {
    const style = findStyle(id);
    return { style, html: markdownToWechat(COMPARISON_SAMPLE, style.accent, undefined, id, style.reading.padX, '', {
      ...style.reading, paper: style.paper, headingStyle: getStyleComponentDefaults(id).headingStyle,
    }) };
  }), []);
  return <main className={css.page}>
    <header className={css.header}>
      <Link href="/" className={css.logo}>楷排<span>文章风格试阅</span></Link>
      <Link href="/" className={css.button}>返回工作台 ↗</Link>
    </header>
    <section className={css.intro}>
      <span className={css.tag}>12 套文章风格</span>
      <h1>同一篇文章，十二种阅读节奏。</h1>
      <p>文字、图片和顺序完全相同。看看标题、段落、引语与图片如何改变阅读感受。</p>
      <div className={css.controls}>
        <button className={css.button} aria-pressed={monochrome} onClick={() => setMonochrome(!monochrome)}>{monochrome ? '✓ 黑白对照' : '黑白对照'}</button>
        <span>去掉颜色，仍能辨认版式。</span>
      </div>
    </section>
    <nav className={css.groups} aria-label="选择风格对照组">
      {COMPARISON_GROUPS.map((item, index) => <button key={item.name} className={css.button} aria-pressed={group === index} onClick={() => setGroup(index)}>{item.name}<span>{item.ids.map(id => findStyle(id).name).join(' / ')}</span></button>)}
    </nav>
    <section className={css.grid} aria-label={`${COMPARISON_GROUPS[group].name}风格对照`}>
      {articles.filter(({style}) => (COMPARISON_GROUPS[group].ids as readonly string[]).includes(style.id)).map(({ style, html }, index) => <section className={css.column} key={style.id}>
        <header className={css.columnHeader}>
          <span className={css.index}>0{index + 1}</span>
          <div><h2>{style.name}</h2><p>{descriptions[style.id]}</p></div>
        </header>
        <p className={css.features}>{style.grammar}</p>
        <article aria-label={`${style.name}样稿`} className={css.article} style={{ filter: monochrome ? 'grayscale(1)' : undefined }} dangerouslySetInnerHTML={{ __html: html }} />
      </section>)}
    </section>
    <footer className={css.footer}>虚构样稿与示意插画，仅用于比较版式。全部样式已加入工作台原有风格列表，切换不会改写正文。</footer>
  </main>;
}
