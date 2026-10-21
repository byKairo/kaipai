import type { AiPlanOptions, ImageScope, ImageTarget } from '../../lib/ai-workbench';
import { styles } from '../../lib/styles';
export type V091SideTab = "ai" | "layout" | "styles" | "drafts";
export type StyleItem = {
  id: string;
  name: string;
  grammar: string;
  accent: string;
  /** Style token paper (used for tinted-paper copy hint). */
  paper?: string;
};
export type DraftItem = {
  id: string;
  title: string;
  updatedAt: number;
};
export type V091SidebarProps = {
  coverContext?: import('./cover-designer').CoverContext;
  tab: V091SideTab;
  onTabChange: (tab: V091SideTab) => void;
  styles: StyleItem[];
  styleId: string;
  styleName: string;
  styleGrammar: string;
  variant: "quiet" | "standard" | "visual";
  accent: string;
  onVariantChange: (variant: "quiet" | "standard" | "visual") => void;
  onAccentChange: (accent: string) => void;
  fontColor?: string;
  markerColor?: string;
  resolvedPaper?: string;
  onFontColorChange?: (color: string) => void;
  onStyleChange: (styleId: string) => void;
  onInsertMarkdown: (md: string) => void;
  /** Patch full article markdown (e.g. upsert :::recs). Prefer over insert for block replace. */
  onPatchContent?: (fn: (md: string) => string) => void;
  /** Apply fluorescent highlight to current editor selection (TipTap mark preferred). */
  onApplyHighlight?: (color: string) => void;
  /** Update highlight/marker color without treating it as theme accent. */
  onHighlightColorChange?: (color: string) => void;
  drafts: DraftItem[];
  onOpenDraft: (id: string) => void;
  onCreateDraft: () => void;
  onLoadSample?: () => void;
  onImportDraft?: () => void;
  onDeleteDraft: (id: string) => void;
  onSay: (msg: string) => void;
  onRunAiPlan?: (options?: AiPlanOptions) => void;
  onPlanAiImages?: (scope: ImageScope, instruction: string) => void;
  onRunAiTool?: (tool: 'layout' | 'images' | 'polish' | 'title') => void;
  onOpenApiSettings?: () => void;
  onApplyAiPlan?: () => boolean | void;
  aiHasPendingPlan?: boolean;
  onDiscardAiPlan?: () => void;
  onRetryAiPlan?: () => void;
  onPlanStyleChange?: (id: string) => void;
  onCopyArticle?: () => void;
  onDownloadImages?: () => void;
  onCancelAiPlan?: () => void;
  aiPlanError?: string;
  aiSummary?: string;
  aiSuggestions?: string[];
  aiImageBriefs?: string[];
  aiImageCards?: Array<{
    id: string;
    brief: string;
    prompt: string;
    src: string;
    ratio?: string;
    target?: ImageTarget;
    visualStyle?: string;
    imageText?: string;
    status: 'idle' | 'loading' | 'done' | 'error';
    error?: string;
  }>;
  aiSavedImages?: Array<{
    id: string;
    brief: string;
    src: string;
  }>;
  onPreviewSavedImage?: (id: string) => void;
  onGenerateAiImage?: (id: string, prompt: string, ratios: string[], visualStyle: string, imageText?: string) => void;
  onInsertAiImage?: (src: string, brief: string, target?: ImageTarget) => void;
  aiTitleOptions?: string[];
  aiResultMode?: 'full' | 'layout' | 'images' | 'title';
  aiRecommendedStyle?: string;
  aiConfigured?: boolean;
  aiMode?: string;
  aiPhase?: "entry" | "running" | "ready";
  /** Advanced reading / heading controls (V091 #advanced-settings). */
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  paragraphGap?: number;
  padX?: number;
  padY?: number;
  imageRadius?: number;
  headingStyle?: string;
  headingIcon?: string;
  headingLabel?: string;
  headingLabels?: Record<string, string>;
  headingPrefix?: string;
  headingSeparator?: string;
  headingNumberFormat?: '01' | '1' | '一' | 'none';
  brandName?: string;
  brandNote?: string;
  savedStylePresets?: {
    id: string;
    name: string;
    note: string;
    styleName: string;
  }[];
  activeSavedStyleId?: string;
  savedStyleDirty?: boolean;
  onSaveStylePreset?: (name: string, note: string) => void;
  onApplyStylePreset?: (id: string) => void;
  onUpdateStylePreset?: (id: string) => void;
  onDeleteStylePreset?: (id: string) => void;
  onFontFamilyChange?: (fontFamily: string) => void;
  onFontSizeChange?: (fontSize: number) => void;
  onLineHeightChange?: (lineHeight: number) => void;
  onParagraphGapChange?: (paragraphGap: number) => void;
  onPadXChange?: (padX: number) => void;
  onPadYChange?: (padY: number) => void;
  onImageRadiusChange?: (imageRadius: number) => void;
  onHeadingStyleChange?: (headingStyle: string) => void;
  onHeadingIconChange?: (headingIcon: string) => void;
  onHeadingLabelChange?: (headingLabel: string) => void;
  onHeadingPrefixChange?: (prefix: string) => void;
  onHeadingSeparatorChange?: (separator: string) => void;
  onHeadingNumberFormatChange?: (format: '01' | '1' | '一' | 'none') => void;
  onReadingChange?: (reading: {
    fontSize: number;
    lineHeight: number;
    paragraphGap: number;
    padX: number;
  }) => void;
  /** Article paper background mode (V091 paperSetting). */
  paperMode?: 'follow' | 'style' | 'custom';
  paperColor?: string;
  paperTextureUrl?: string;
  onPaperTextureUrlChange?: (value:string)=>void;
  onPaperModeChange?: (mode: 'follow' | 'style' | 'custom') => void;
  onPaperColorChange?: (color: string) => void;
};
export const VARIANT_LABEL: Record<string, string> = {
  quiet: "克制",
  standard: "标准",
  visual: "视觉化",
};
/** Fixed Soft-NEO / V091 late-patch order — always 12 cards in place. */
// 4 大主题 × 3 分支（网格每行一族）
// read  阅读留白: knowledge, editorial, edu
// voice 观点媒体: opinion, tech, research
// brand 商务品牌: business, corp, festival
// pulse 活动个性: event, boldneo, pixelpost
export const STYLE_ORDER = [
  "knowledge",
  "editorial",
  "edu",
  "opinion",
  "tech",
  "research",
  "business",
  "corp",
  "festival",
  "event",
  "boldneo",
  "pixelpost",
] as const;
export const STYLE_FAMILY: Record<(typeof STYLE_ORDER)[number], "read" | "voice" | "brand" | "pulse"> = {
  knowledge: "read",
  editorial: "read",
  edu: "read",
  opinion: "voice",
  tech: "voice",
  research: "voice",
  business: "brand",
  corp: "brand",
  festival: "brand",
  event: "pulse",
  boldneo: "pulse",
  pixelpost: "pulse",
};
export const STYLE_NAMES = Object.fromEntries(styles.map(style => [style.id, style.name])) as Record<(typeof STYLE_ORDER)[number], string>;
export const STYLE_SUMMARY = Object.fromEntries(styles.map(style => [style.id, style.grammar])) as Record<(typeof STYLE_ORDER)[number], string>;
/** Final V091 heading library (late v072 splice — same ids, updated labels/previews). */
export const HEADING_STYLES = [
  { id: "bar", label: "编号轨道", desc: "大编号 + 横向细线 · 知识/报告", preview: "<span class='hp-rail'><b>01</b><i></i><em>章节标题</em></span>" },
  { id: "frame", label: "侧签标题", desc: "荧光竖条 + 编号 + 标题", preview: "<span class='hp-ribbon'><i></i><b>01</b><span>章节标题</span></span>" },
  { id: "twin", label: "编号细线", desc: "自动编号 + 主标题 + 细线", preview: "<span class='hp-editorial'><small>01 /</small><b>章节标题</b></span>" },
  { id: "markerHalf", label: "半荧光", desc: "中文序号 + 文字下半部荧光", preview: "<span class='hp-marker-number'>一、</span><span class='hp-marker-half'>章节标题</span>" },
  { id: "markerUnder", label: "荧光编号", desc: "主题色序号 + 主标题", preview: "<span class='hp-marker-tag'><i>01</i><span>章节标题</span></span>" },
  { id: "markerLine", label: "荧光下划线", desc: "编号和标题共用荧光下划线", preview: "<span class='hp-marker-line'>01 章节标题</span>" },
  { id: "numberFrame", label: "上置编号细框", desc: "细荧光方框 + 顶部居中编号", preview: "<span class='hp-number-frame'><i>01</i><span>章节标题</span></span>" },
  { id: "iconTag", label: "图标侧签", desc: "图形锚点 + 标题 · 轻 IP 感", preview: "<span class='hp-icon'>◆</span><span>章节标题</span>" },
  { id: "avatarLeft", label: "IP 头像左置", desc: "头像 + 标题 · 个人专栏", preview: "<span class='hp-avatar'>IP</span><span>章节标题</span>" },
  { id: "avatarTop", label: "IP 头像上置", desc: "头像居上 + 标题 · 栏目签名", preview: "<span class='hp-stack'><span class='hp-avatar'>IP</span><span>章节标题</span></span>" },
  { id: "poster", label: "大号序章", desc: "超大数字 + 标题 · 强章节感", preview: "<span class='hp-big'>01</span><span>章节标题</span>" },
] as const;
export const READING_PRESETS: Record<string, {
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  padX: number;
}> = {
  compact: { fontSize: 15, lineHeight: 1.68, paragraphGap: 12, padX: 24 },
  standard: { fontSize: 16, lineHeight: 1.82, paragraphGap: 16, padX: 30 },
  relaxed: { fontSize: 16, lineHeight: 1.96, paragraphGap: 22, padX: 36 },
};
export const DEFAULT_FONT_FAMILY = '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif';
export const FOLLOW_DEFAULTS: Record<string, [
  string,
  string,
  string
]> = {
  minimal: ["关注我们", "持续分享真正有用的内容", "关注公众号"],
  brand: ["关注我们", "持续更新", "关注公众号"],
  card: ["持续更新", "把有用的内容留给你", "关注公众号"],
  neo: ["订阅下一篇内容", "持续分享真正有用的内容", "关注公众号"],
  qr: ["扫码关注", "获取完整内容与更新", "关注公众号"],
  avatar: ["作者｜楷排编辑部", "持续分享真正有用的内容", "关注公众号"],
  split: ["继续阅读", "获取下一篇文章", "关注公众号"],
  account: ["楷排编辑部", "持续分享真正有用的内容", "关注公众号"],
};
export const EMOJI_CHOICES = '😀 😃 😄 😁 😆 😅 😂 🙂 🙃 😉 😊 😎 🥰 😍 🤩 😘 😋 😜 🤔 🧐 🤓 😇 🥳 🤗 😌 😴 😮 😲 😢 😭 😤 👍 👏 🙌 👌 ✌️ 🤝 💪 👀 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💯 ✅ ❌ ❗ ❓ ⭐ 🌟 ✨ ⚡ 🔥 💥 🎉 🎊 🎈 🎁 🏆 🥇 🎯 🎨 🎬 🎵 🎧 📷 📸 📺 💻 📱 ⌨️ 🖥️ 💡 🔦 🔍 🔎 📌 📍 📝 ✏️ 📚 📖 📕 📗 📘 📙 📓 🗂️ 📊 📈 📉 💼 💰 🪙 🏠 🏢 🏙️ 🌍 🌎 🌏 🌞 ☀️ 🌙 ☁️ 🌈 ❄️ 🌊 🌸 🌷 🌻 🌿 🍀 🌱 🌲 🐱 🐶 🐼 🦊 🐻 🦄 🐳 🦋 🍎 🍋 🍉 🍇 🍓 🍒 ☕ 🍵 🍰 🍕 🍔 🚗 🚲 ✈️ 🚀 ⏰ ⌛ 🔔 🔒 🔑 🧩 🧠 💬 💭 📣 📢 ➡️ ⬅️ ⬆️ ⬇️'.split(' ');
export const EMOJI_NAMES: Record<string, string> = { '💡': '灵感 灯泡', '📚': '书 阅读', '📖': '书 阅读', '✨': '星 光', '⭐': '星', '🚀': '火箭', '📌': '图钉', '🎯': '目标', '🌿': '植物', '☕': '咖啡', '🧠': '大脑 思考', '💬': '聊天', '📊': '图表', '🎉': '庆祝', '🔥': '火 热' };
export const INSERT_SNIPPETS: Record<string, string> = {
  lead: ":::lead\n导语：用一句话说清这篇文章要解决的问题。\n:::",
  author: ":::author\n作者｜楷排编辑部\n:::",
  tip: ":::tip\n这里放一条关键提示。\n:::",
  warn: ":::warn\n注意：这里写限制、风险或容易踩坑的事项。\n:::",
};
export function barPreview(prefix: string, label: string, numberFormat: string, separator = '') {
  const number = numberFormat === 'none' ? '' : numberFormat === '一' ? '一' : numberFormat === '1' ? '1' : '01';
  return [[prefix, label, number].filter(Boolean).join(' '), separator].filter(Boolean).join(' ');
}
