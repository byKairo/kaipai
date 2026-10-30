import type { ArticleDesign } from '../styles';
import type { Theme } from './elements';
import { accentTextOnPaper } from './palette';

/** Reading purpose controls structure as well as color. No content is generated here. */
export const styleUseCases: Record<ArticleDesign, { audience: string; purpose: string; avoid: string }> = {
 cotton: { audience: '观点作者、专栏写作者', purpose: '连续长读，依靠章题与原有加粗定位', avoid: '密集卡片、整段变色' },
 portrait: { audience: '人物作者、经历分享者', purpose: '慢读与叙述停顿，突出原话和场景', avoid: '密集步骤、重色数据块' },
 brief: { audience: '管理者、产品与业务读者', purpose: '快速扫读结论、取舍与行动', avoid: '宽松到需要反复翻屏' },
 idea: { audience: '创作者、学习笔记者', purpose: '短想法、手记与灵感摘录', avoid: '长篇严肃报告' },
 log: { audience: '教程作者、动手实践者', purpose: '按步骤完成操作，代码与提醒容易找到', avoid: '不含步骤的长篇抒情' },
 brand: { audience: '产品团队、设计与品牌作者', purpose: '图片与产品细节主导阅读', avoid: '小屏密集数据清单' },
 research: { audience: '研究者、行业分析读者', purpose: '核对图表、解释和来源', avoid: '用装饰压过证据' },
 column: { audience: '科普作者、知识型读者', purpose: '一个问题对应一个完整解释', avoid: '没有问题结构时强行分卡' },
 weekend: { audience: '摄影师、旅行与生活记录者', purpose: '先看照片，再读图注与叙事', avoid: '没有图片的密集技术文章' },
 culture: { audience: '短句作者、文学与文化读者', purpose: '停顿、短句与诗节；长段仍左齐', avoid: '居中排列长段正文' },
 neo: { audience: '对话作者、轻松科普创作者', purpose: '章节如分镜，已有引语像对话', avoid: '把普通正文全部装成气泡' },
 pixel: { audience: '夜读与个人随笔读者', purpose: '深底低刺激的宋体长读', avoid: '霓虹大色块和高密度数据' },
};

export function emphasisStyle(t: Theme): string {
 if(t.style.preset) return 'font-weight:700;color:inherit;';
 const weights: Record<ArticleDesign, number> = { cotton: 700, portrait: 600, brief: 750, idea: 700, log: 700, brand: 650, research: 700, column: 750, weekend: 600, culture: 600, neo: 850, pixel: 650 };
 // Preserve the author's existing emphasis. No automatic sentence selection or new marks.
 const accent = ['cotton', 'idea', 'log', 'column'].includes(t.style.design) ? accentTextOnPaper(t.accent, t.paper, t.ink) : t.ink;
 return `font-weight:${weights[t.style.design]};color:${accent}`;
}

export function codeSkin(t: Theme) {
 if(t.style.preset){const p=t.style.preset;const dark=['macd','tab','sticker'].includes(p.c);return {background:dark?'#0d1117':t.surface,ink:dark?'#e8eaed':t.ink,header:dark?'#1c2128':t.surface,labelInk:dark?'#b5bdcc':t.muted,chrome:'label' as const,padding:'12px 14px',margin:'24px 0',size:13,frame:p.c==='listing'?`border-top:2px solid ${t.ink};border-bottom:2px solid ${t.ink}`:p.c==='tape'?`border:1px dashed ${t.line}`:p.c==='sticker'?`border:2px solid ${t.ink};border-top:4px solid ${t.accent}`:p.c==='side'?`border-top:3px solid ${t.accent}`:p.c==='frame'?`border:3px double ${t.ink}`:p.c==='narr'?`border:2px solid ${t.ink};background-color:${t.style.colors.mark}`:p.c==='hair'?`border-top:1px solid ${t.line};border-bottom:1px solid ${t.line}`:p.c==='indent'?`border-left:1px solid ${t.line};margin-left:12px;margin-right:6px`:p.c==='tab'?`border-top:3px solid ${t.accent};border-radius:6px`:`border:1px solid ${t.line};border-radius:${p.r}`};}
 const d = t.style.design;
 const light = { background: t.surface, ink: t.ink, header: t.paper, labelInk: t.muted };
 const dark = { background: '#1e2128', ink: '#e8eaed', header: '#2a2e36', labelInk: '#b5bdcc' };
 const base = ['log', 'neo', 'pixel'].includes(d) ? dark : light;
 const skins: Record<ArticleDesign, { frame: string; chrome: 'traffic' | 'label' | 'none'; padding: string; margin: string; size: number }> = {
  cotton: { frame: `border:0;border-top:1px solid ${t.line};border-bottom:1px solid ${t.line}`, chrome: 'label', padding: '16px 14px', margin: '28px 0', size: 13 },
  portrait: { frame: `border:0;border-left:1px solid ${t.line}`, chrome: 'none', padding: '18px 14px', margin: '32px 0', size: 13 },
  brief: { frame: `border:1px solid ${t.line};border-radius:0`, chrome: 'label', padding: '10px 12px', margin: '18px 0', size: 12 },
  idea: { frame: `border:1px dashed ${t.line};border-radius:3px`, chrome: 'label', padding: '16px', margin: '26px 4px', size: 13 },
  log: { frame: 'border:1px solid #46515e;border-radius:6px', chrome: 'traffic', padding: '16px', margin: '22px 0', size: 14 },
  brand: { frame: `border:0;border-top:2px solid ${t.ink}`, chrome: 'label', padding: '20px 16px', margin: '36px 0', size: 13 },
  research: { frame: `border:1px solid ${t.line};border-radius:0`, chrome: 'label', padding: '14px 12px', margin: '24px 0', size: 12 },
  column: { frame: `border:0;border-left:3px solid ${t.ink}`, chrome: 'label', padding: '14px', margin: '20px 0', size: 13 },
  weekend: { frame: `border:0;border-bottom:1px solid ${t.line}`, chrome: 'none', padding: '20px 16px', margin: '40px 0', size: 13 },
  culture: { frame: `border:0;border-top:1px solid ${t.line};border-bottom:1px solid ${t.line}`, chrome: 'none', padding: '24px 12px', margin: '40px 0', size: 13 },
  neo: { frame: 'border:3px solid #202020;box-shadow:4px 4px 0 #202020;border-radius:0', chrome: 'traffic', padding: '14px', margin: '24px 8px 24px 0', size: 14 },
  pixel: { frame: `border:1px solid ${t.line};border-radius:0`, chrome: 'label', padding: '20px 16px', margin: '32px 0', size: 13 },
 };
 return { ...base, ...skins[d] };
}
