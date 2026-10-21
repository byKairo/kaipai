import { styles } from '../../lib/styles';
import type { ArticleRecord } from '../../lib/document';

const V091_HEADING_IDS = new Set([
  'bar', 'frame', 'twin', 'markerHalf', 'markerUnder', 'markerLine', 'numberFrame', 'eyebrow', 'iconTag', 'avatarLeft', 'avatarTop', 'poster',
]);
const LEGACY_HEADING_MAP: Record<string, string> = {
  style: 'bar',
  line: 'twin',
  twin: 'twin',
  corner: 'frame',
  frame: 'frame',
  marker: 'markerHalf',
  markerHalf: 'markerHalf',
  markerUnder: 'markerUnder',
  iconTag: 'iconTag',
  avatarLeft: 'avatarLeft',
  avatarTop: 'avatarTop',
  label: 'frame',
  brand: 'frame',
};
export function normalizeHeadingStyle(value?: string) {
  if (!value) return 'bar';
  if (value === 'eyebrow') return 'twin';
  if (V091_HEADING_IDS.has(value)) return value;
  return LEGACY_HEADING_MAP[value] || 'bar';
}

export function barLabels(value: unknown, legacyLabel = '', styleId = ''): Record<string, string> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const labels = Object.fromEntries(Object.entries(source).filter(([key, text]) => key.startsWith('bar:') && typeof text === 'string').map(([key, text]) => [key, String(text).slice(0, 12)]));
  if (!Object.keys(labels).length && legacyLabel && styleId) labels[`bar:${styleId}`] = legacyLabel.slice(0, 12);
  return labels;
}

export function barPrefixes(value: unknown): Record<string, string> {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(source).filter(([key, prefix]) => styles.some((item) => item.id === key) && typeof prefix === 'string').map(([key, prefix]) => [key, String(prefix).slice(0, 4)]));
}

export function normalizedPresetAppearance(a: NonNullable<ArticleRecord['appearance']>, styleId: string): NonNullable<ArticleRecord['appearance']> {
  const headingStyle = normalizeHeadingStyle(a.headingStyle);
  const headingLabels = barLabels(a.headingLabels, headingStyle === 'bar' ? a.headingLabel : '', styleId);
  return {
    accent: a.accent, markerColor: a.markerColor, variant: a.variant, fontSize: a.fontSize, lineHeight: a.lineHeight,
    padX: a.padX, padY: a.padY, imageRadius: a.imageRadius, paragraphGap: a.paragraphGap ?? 16,
    fontFamily: a.fontFamily || '"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif', fontColor: a.fontColor || '',
    headingStyle, headingIcon: a.headingIcon || '◆', headingLabel: headingStyle === 'bar' ? headingLabels[`bar:${styleId}`] ?? '' : '',
    headingLabels, headingPrefixes: barPrefixes(a.headingPrefixes), headingSeparators: barPrefixes(a.headingSeparators), headingNumberFormat: a.headingNumberFormat || '01',
    paperMode: a.paperMode || 'style', paperColor: a.paperColor || '#ffffff', paperTextureUrl: a.paperTextureUrl || '', unorderedMarker: a.unorderedMarker, orderedMarker: a.orderedMarker,
  };
}

