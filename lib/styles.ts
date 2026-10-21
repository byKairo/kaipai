import { articleColorRecipes, type ArticleColorRecipe } from './article-styles/color-recipes';

export type StyleReading = {
    fontSize: number;
    lineHeight: number;
    padX: number;
    padY: number;
    imageRadius: number;
    paragraphGap?: number;
};
export type ArticleDesign = 'cotton' | 'idea' | 'log' | 'brief' | 'brand' | 'research' | 'portrait' | 'column' | 'weekend' | 'culture' | 'neo' | 'pixel';
export type ImageTreatment = 'plain' | 'polaroid' | 'film' | 'magazine';
export type ArticleStyle = {
    id: string;
    design: ArticleDesign;
    name: string;
    grammar: string;
    font: 'sans' | 'serif' | 'mono';
    paper: string;
    accent: string;
    reading: StyleReading;
    thirdHeadingStyle: 'rail' | 'fluorescent' | 'double';
    imageTreatment: ImageTreatment;
    colors: ArticleColorRecipe & {
        accent: string;
        text: string;
        background: string;
    };
    typography: {
        bodySize: number;
        lineHeight: number;
        fontFamily: string;
    };
};
type Definition = [
    string,
    ArticleDesign,
    string,
    string,
    ArticleStyle['font'],
    string,
    string,
    ImageTreatment
];
const sans = "'PingFang SC','Microsoft YaHei',system-ui,sans-serif";
const serif = "'Songti SC',SimSun,serif";
const mono = 'Menlo,Consolas,monospace';
/** IDs and their order are persisted in old articles and local settings. Never recycle/reorder them. */
const definitions: Definition[] = [
    ['knowledge', 'cotton', '作者专栏', '报刊题头 · 左齐论点 · 内缩引语 · 连续长读', 'serif', '#f7f7f4', '#607d85', 'plain'],
    ['opinion', 'idea', '灵感手记', '标签章节 · 虚线笔记 · 便签引语 · 拍立得', 'sans', '#f7f3e9', '#3157b0', 'polaroid'],
    ['tech', 'log', '操作教程', '步骤编号 · 纵向引导线 · 操作图 · 注意提示', 'sans', '#f6f9f8', '#426c69', 'magazine'],
    ['business', 'brief', '决策简报', '结论前置 · 紧凑字级 · 编号决策项 · 清单与取舍表', 'sans', '#ffffff', '#264c70', 'magazine'],
    ['corp', 'brand', '产品画册', '宽幅大图 · 大字编号 · 留白展陈 · 参数横线表', 'sans', '#ffffff', '#8d343e', 'plain'],
    ['research', 'research', '数据报告', '报告题头 · 分层编号 · 图表边界 · 三线表与来源', 'sans', '#fffefa', '#79664c', 'plain'],
    ['editorial', 'portrait', '人物叙事', '窄版心 · 宋体长读 · 首字下沉 · 无框人物引语', 'serif', '#f8f5ef', '#8d5d50', 'magazine'],
    ['edu', 'column', '科普问答', '问题编号 · 独立问答区块 · 结论强调 · 来源注释', 'sans', '#ffffff', '#b75c32', 'plain'],
    ['event', 'weekend', '摄影故事', '全幅照片 · 编号图注 · 内缩叙述 · 大段留白', 'sans', '#fff8f3', '#b96151', 'plain'],
    ['festival', 'culture', '短句诗页', '居中短句 · 诗节留白 · 细线章题 · 长段落左齐', 'serif', '#fff8ef', '#b84938', 'plain'],
    ['boldneo', 'neo', '对话漫画', '分镜外框 · 交错引语气泡 · 旁白正文 · 原图保留', 'sans', '#fff9e9', '#b1d5ee', 'polaroid'],
    ['pixelpost', 'pixel', '夜读散文', '深底宋体 · 宽松段距 · 点状章节 · 轻量引语', 'serif', '#12131e', '#71efb4', 'plain'],
];
const readingDefaults: Record<ArticleDesign, StyleReading> = {
    portrait: { fontSize: 17, lineHeight: 2, paragraphGap: 24, padX: 36, padY: 40, imageRadius: 0 },
    column: { fontSize: 16, lineHeight: 1.85, paragraphGap: 16, padX: 16, padY: 24, imageRadius: 0 },
    brand: { fontSize: 15, lineHeight: 1.9, paragraphGap: 20, padX: 16, padY: 24, imageRadius: 0 },
    cotton: { fontSize: 17, lineHeight: 1.95, paragraphGap: 20, padX: 26, padY: 32, imageRadius: 0 },
    idea: { fontSize: 16, lineHeight: 1.9, paragraphGap: 22, padX: 24, padY: 30, imageRadius: 0 },
    log: { fontSize: 15, lineHeight: 1.9, paragraphGap: 16, padX: 18, padY: 24, imageRadius: 0 },
    brief: { fontSize: 15, lineHeight: 1.85, paragraphGap: 14, padX: 22, padY: 24, imageRadius: 0 },
    research: { fontSize: 15, lineHeight: 1.9, paragraphGap: 18, padX: 24, padY: 30, imageRadius: 0 },
    weekend: { fontSize: 15, lineHeight: 2, paragraphGap: 24, padX: 12, padY: 32, imageRadius: 0 },
    culture: { fontSize: 17, lineHeight: 2.2, paragraphGap: 32, padX: 32, padY: 48, imageRadius: 0 },
    neo: { fontSize: 16, lineHeight: 1.85, paragraphGap: 18, padX: 18, padY: 26, imageRadius: 0 },
    pixel: { fontSize: 17, lineHeight: 2.1, paragraphGap: 28, padX: 30, padY: 44, imageRadius: 0 },
};
/** Single source used by picker, renderer, AI context and saved presets. */
export const styles: ArticleStyle[] = definitions.map(([id, design, name, grammar, font, paper, accent, imageTreatment]) => {
    const reading: StyleReading = readingDefaults[design];
    return { id, design, name, grammar, font, paper, accent, imageTreatment, reading,
        thirdHeadingStyle: font === 'serif' ? 'double' : design === 'neo' ? 'fluorescent' : 'rail',
        colors: { ...articleColorRecipes[design], accent, background: paper },
        typography: { bodySize: reading.fontSize, lineHeight: reading.lineHeight, fontFamily: font === 'serif' ? serif : font === 'mono' ? mono : sans },
    };
});
export function findStyle(id: string) { return styles.find(style => style.id === id) ?? styles[0]; }
export const styleComponentDefaults: Record<string, {
    divider: string;
    follow: string;
    headingStyle: string;
    headingNumberFormat: '01' | 'none';
}> = Object.fromEntries(styles.map(style => [style.id, {
        divider: style.design === 'neo' ? 'neo' : 'hairline',
        follow: style.design === 'neo' ? 'neo' : style.design === 'brand' ? 'brand' : 'minimal',
        headingStyle: 'bar',
        headingNumberFormat: style.design === 'neo' || style.design === 'pixel' ? 'none' : '01',
    }]));
export function getStyleComponentDefaults(id: string) { return styleComponentDefaults[id] ?? { divider: 'hairline', follow: 'minimal', headingStyle: 'bar', headingNumberFormat: '01' as const }; }
