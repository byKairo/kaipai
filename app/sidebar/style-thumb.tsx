import { memo, useMemo } from 'react';
import { findStyle, getStyleComponentDefaults } from '../../lib/styles';
import { markdownToWechat } from '../../lib/wechat-html';
export const StyleThumb = memo(function StyleThumb({ id }: {
  id: string;
}) {
  const html = useMemo(() => { const style = findStyle(id); return markdownToWechat('# 把一盏灯，留给夜晚\n\n## 为什么要把光收回来？\n\n设计从每一次真实使用开始。\n\n![灯与书页](/article-assets/lamp-study.svg)\n\n> 让人更愿意停留。', style.accent, '#fff07a', id, style.reading.padX, '', { ...style.reading, headingStyle: getStyleComponentDefaults(id).headingStyle, paper: style.paper, variant: '标准' }); }, [id]);
  return <span className="v080-style-thumb" data-style={id} aria-hidden="true">
    <span className="thumb-page" dangerouslySetInnerHTML={{ __html: html }} />
  </span>;
});
