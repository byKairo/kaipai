/** Validated, source-anchored editorial operations; previews never replace the source. */
export type LayoutKind = 'replace' | 'delete' | 'move' | 'split' | 'merge' | 'heading' | 'emphasis' | 'clarify';
export type Anchor = { quote: string; prefix?: string; suffix?: string };
export type LayoutSuggestion = { id: string; kind: LayoutKind; anchor: Anchor; proposal: string | null; reason: string; presentation?: 'bold' | 'highlight' | 'standalone' | null; move_target?: { anchor: Anchor; placement: 'before' | 'after' } | null; depends_on: string[]; conflicts_with: string[] };
export type LayoutReview = { summary: string; keep: { quote: string; reason: string }[]; suggestions: LayoutSuggestion[]; rejected?: { id: string; reason: string }[] };
export const layoutLabels: Record<LayoutKind, string> = { replace: '断句与表达', delete: '删减重复', move: '结构与顺序', split: '拆分段落', merge: '合并段落', heading: '标题层级', emphasis: '重点强调', clarify: '待确认' };
const fail = (message: string): never => { throw new Error(message); };
export function locateAnchor(source: string, anchor: Anchor): { from: number; to: number } {
  if (!anchor || typeof anchor.quote !== 'string' || !anchor.quote.trim()) return fail('建议缺少准确原文');
  const hits: number[] = [];
  let start = 0;
  while (start <= source.length) {
    const at = source.indexOf(anchor.quote, start); if (at < 0) break;
    if ((!anchor.prefix || source.slice(0, at).endsWith(anchor.prefix)) && (!anchor.suffix || source.slice(at + anchor.quote.length).startsWith(anchor.suffix))) hits.push(at);
    start = at + 1;
  }
  if (hits.length !== 1) return fail('建议原文无法唯一定位，请重新生成；正文未修改');
  return { from: hits[0], to: hits[0] + anchor.quote.length };
}
const compact = (s: string) => s.replace(/\s/g, '');
const blocks = (s: string) => Array.from(s.matchAll(/^```[^\n]*\n[\s\S]*?^```[^\n]*$|^~~~[^\n]*\n[\s\S]*?^~~~[^\n]*$|^(?:[ \t]*\|[^\n]*\|[ \t]*(?:\n|$))+|^:::[\s\S]*?^:::[ \t]*$/gm)).map(m => ({ from: m.index!, to: m.index! + m[0].length }));
const links = (s: string) => s.match(/`+[^`]*`+|!?\[[^\]]*\]\([^\n)]*\)|https?:\/\/[^\s)>]+/g) || [];
const blockBoundary = (source: string, range: {from: number; to: number}) => (range.from === 0 || /\n\s*\n$/.test(source.slice(0, range.from))) && (range.to === source.length || /^\n\s*\n/.test(source.slice(range.to)));
export function parseLayoutReview(value: unknown, source: string): LayoutReview {
  const raw = value as LayoutReview;
  if (!raw || typeof raw.summary !== 'string' || !raw.summary.trim() || !Array.isArray(raw.suggestions) || raw.suggestions.length > 30 || !Array.isArray(raw.keep)) return fail('模型未返回完整的文章审阅方案，请重试；不会改用基础排版');
  const ids = new Set<string>();
  const protectedBlocks = [...blocks(source), ...Array.from(source.matchAll(/`+[^`\n]+`+|!?\[[^\]]*\]\([^\n)]*\)/g), m => ({ from: m.index!, to: m.index! + m[0].length }))];
  for (const s of raw.suggestions) {
    if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id) || !Object.prototype.hasOwnProperty.call(layoutLabels, s.kind) || typeof s.reason !== 'string' || !s.reason.trim() || !Array.isArray(s.depends_on) || !Array.isArray(s.conflicts_with)) return fail('编辑建议的编号、类型或理由不完整');
    ids.add(s.id);
    const range = locateAnchor(source, s.anchor);
    if (s.kind !== 'clarify' && protectedBlocks.some(b => range.from < b.to && range.to > b.from)) return fail('建议涉及代码、表格或自定义组件，已拒绝应用；请重新生成');
    if (['emphasis', 'move'].includes(s.kind) && s.proposal != null) return fail('强调和移动不能同时改写文字');
    if (s.kind === 'clarify') { if (s.proposal != null) return fail('待确认项不能包含可执行改写'); continue; }
    if (['replace', 'split', 'merge', 'heading', 'delete'].includes(s.kind)) {
      if (typeof s.proposal !== 'string' || (s.kind === 'delete' ? s.proposal !== '' : !s.proposal.trim())) return fail('编辑建议缺少拟议文本');
      if (/<\/?[a-z][^>]*>/i.test(s.proposal!)) return fail('编辑建议不能包含 HTML');
      if (JSON.stringify(links(s.anchor.quote)) !== JSON.stringify(links(s.proposal!))) return fail('编辑建议改变了链接或图片，已拒绝应用');
    }
    if (s.kind === 'split' || s.kind === 'merge') {
      if (!blockBoundary(source, range) || compact(s.anchor.quote) !== compact(s.proposal!)) return fail('拆分或合并段落必须保留完整段落的文字');
    }
    if (s.kind === 'heading') {
      const cause = !blockBoundary(source, range) ? '选中的原文不是完整段落'
        : compact(s.anchor.quote.replace(/^#{1,6}\s+/gm, '')) !== compact(s.proposal!.replace(/^#{1,6}\s+/gm, '')) ? '在调整层级时改写了标题文字或格式'
        : !/^#{1,3} [^\n]+$/.test(s.proposal!) ? '返回的标题不是单行一至三级 Markdown 标题' : '';
      if (cause) return fail(`AI 标题建议 ${s.id} 未通过校验：${cause}。原文「${s.anchor.quote.slice(0, 100)}」；建议「${s.proposal!.slice(0, 100)}」。这不是原文标题错误，正文未修改。`);
    }
    if (s.kind === 'emphasis') {
      if (!['bold', 'highlight', 'standalone'].includes(s.presentation || '') || /\n|[*`=\[\]<>]/.test(s.anchor.quote)) return fail('强调必须定位到未带格式的连续原句');
      if (s.presentation === 'standalone' && !blockBoundary(source, range)) return fail('独立呈现必须选择完整段落');
    }
    if (s.kind === 'move') {
      if (!s.move_target || !['before', 'after'].includes(s.move_target.placement) || !blockBoundary(source, range)) return fail('移动必须给出完整段落和准确目的地');
      const target = locateAnchor(source, s.move_target.anchor);
      if (!blockBoundary(source, target) || target.from < range.to && target.to > range.from) return fail('移动目的地无效');
    }
  }
  for (const s of raw.suggestions) {
    for (const id of [...s.depends_on, ...s.conflicts_with]) if (typeof id !== 'string' || id === s.id || !ids.has(id)) return fail('建议依赖或互斥编号无效');
    const visit = (id: string, seen: Set<string>) => { if (seen.has(id)) return fail('建议依赖不能形成循环'); const next = new Set(seen).add(id); raw.suggestions.find(x => x.id === id)!.depends_on.forEach(dep => visit(dep, next)); };
    visit(s.id, new Set());
  }
  for (const k of raw.keep) if (!k || typeof k.reason !== 'string' || !k.reason.trim() || typeof k.quote !== 'string' || !source.includes(k.quote)) return fail('建议保留的内容无法对应原文');
  return raw;
}
/** Isolate invalid model operations without weakening validation or changing the source. */
export function prepareLayoutReview(value: unknown, source: string): LayoutReview {
  const raw = value as LayoutReview;
  // Invalid envelopes are still failures; never substitute a basic layout.
  parseLayoutReview({ ...raw, suggestions: [], keep: [] }, source);
  if (!Array.isArray(raw.suggestions) || raw.suggestions.length > 30 || !Array.isArray(raw.keep)) return fail('模型未返回完整的文章审阅方案，请重试；正文未修改');
  const rejected: { id: string; reason: string }[] = [];
  const invalid = new Set<string>();
  const counts = new Map<string, number>();
  raw.suggestions.forEach(s => { if (s?.id) counts.set(s.id, (counts.get(s.id) || 0) + 1); });
  const candidates: LayoutSuggestion[] = [];
  raw.suggestions.forEach((s, index) => {
    const id = typeof s?.id === 'string' ? s.id : `第 ${index + 1} 条`;
    try {
      if (!s || counts.get(s.id) !== 1) fail('建议编号缺失或重复，无法安全关联');
      if (!Array.isArray(s.depends_on) || !Array.isArray(s.conflicts_with) || [...s.depends_on, ...s.conflicts_with].some(ref => typeof ref !== 'string' || ref === s.id || !counts.has(ref))) fail('建议依赖或互斥编号无效');
      parseLayoutReview({ summary: raw.summary, keep: [], suggestions: [{ ...s, depends_on: [], conflicts_with: [] }] }, source);
      candidates.push(s);
    } catch (error) {
      invalid.add(id);
      rejected.push({ id, reason: error instanceof Error ? error.message : '建议格式无法识别' });
    }
  });
  const byId = new Map(candidates.map(s => [s.id, s]));
  const cyclic = (id: string, path = new Set<string>(), visited = new Set<string>()): boolean => {
    if (path.has(id)) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    const next = new Set(path).add(id);
    return (byId.get(id)?.depends_on || []).some(dep => cyclic(dep, next, visited));
  };
  for (const s of candidates) if (cyclic(s.id)) { invalid.add(s.id); rejected.push({ id: s.id, reason: '建议存在循环依赖，已保留原文' }); }
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of candidates) if (!invalid.has(s.id) && s.depends_on.some(id => invalid.has(id))) {
      invalid.add(s.id); changed = true;
      rejected.push({ id: s.id, reason: '依赖的建议未通过检查，此项也未采用' });
    }
  }
  const keep = raw.keep.filter((item, index) => {
    try { parseLayoutReview({ summary: raw.summary, suggestions: [], keep: [item] }, source); return true; }
    catch { rejected.push({ id: `保留说明 ${index + 1}`, reason: '无法对应原文，已略去这条说明' }); return false; }
  });
  const suggestions = candidates.filter(s => !invalid.has(s.id)).map(s => ({ ...s, conflicts_with: s.conflicts_with.filter(id => !invalid.has(id)) }));
  return { ...parseLayoutReview({ summary: raw.summary, keep, suggestions }, source), rejected };
}

export function previewLayout(source: string, suggestions: LayoutSuggestion[], selected: string[]): string {
  if (selected.some(id => !suggestions.some(s => s.id === id && s.kind !== 'clarify'))) return fail('所选建议不可执行');
  const chosen = suggestions.filter(s => selected.includes(s.id));
  const byId = new Map(chosen.map(s => [s.id, s]));
  const dependsOn = (s: LayoutSuggestion, id: string, visited = new Set<string>()): boolean => {
    if (visited.has(s.id)) return false;
    visited.add(s.id);
    return s.depends_on.some(dep => dep === id || (byId.has(dep) && dependsOn(byId.get(dep)!, id, visited)));
  };
  for (const s of chosen) {
    if (s.depends_on.some(id => !selected.includes(id))) return fail(`${s.id} 需要同时选择 ${s.depends_on.join('、')}`);
    if (s.conflicts_with.some(id => selected.includes(id))) return fail(`${s.id} 与已选建议互斥，请只选择其中一项`);
  }
  const ranges = chosen.flatMap(s => {
    const entries = [{ ...locateAnchor(source, s.anchor), suggestion: s }];
    if (s.kind === 'move') {
      const target = locateAnchor(source, s.move_target!.anchor);
      const at = s.move_target!.placement === 'before' ? target.from : target.to;
      entries.push({ from: at, to: at, suggestion: s });
    }
    return entries;
  });
  for (let i = 0; i < ranges.length; i++) for (let j = i + 1; j < ranges.length; j++) {
    const a = ranges[i], b = ranges[j];
    if (a.suggestion.id === b.suggestion.id) continue;
    const overlap = a.from === b.from || (a.from < b.to && b.from < a.to);
    if (overlap && !dependsOn(a.suggestion, b.suggestion.id) && !dependsOn(b.suggestion, a.suggestion.id)) return fail('已选建议的作用范围重叠且未说明先后依赖，请分别预览和采纳');
  }
  const ordered: LayoutSuggestion[] = [];
  const visited = new Set<string>(), visiting = new Set<string>();
  const visit = (s: LayoutSuggestion) => {
    if (visiting.has(s.id)) return fail('建议依赖不能形成循环');
    if (visited.has(s.id)) return;
    visiting.add(s.id);
    s.depends_on.forEach(id => visit(byId.get(id)!));
    visiting.delete(s.id); visited.add(s.id); ordered.push(s);
  };
  chosen.forEach(visit);
  let current = source;
  for (const s of ordered) {
    // Re-anchor every step against the preceding result. No fuzzy matching or stale offsets.
    const range = locateAnchor(current, s.anchor);
    let replacement = s.proposal || '';
    if (s.kind === 'emphasis') replacement = s.presentation === 'highlight' ? `==${s.anchor.quote}==` : s.presentation === 'bold' ? `**${s.anchor.quote}**` : `> ${s.anchor.quote}`;
    const edits = [{ ...range, text: replacement }];
    if (s.kind === 'move') {
      edits[0].text = '';
      const target = locateAnchor(current, s.move_target!.anchor);
      const at = s.move_target!.placement === 'before' ? target.from : target.to;
      edits.push({from:at,to:at,text:s.move_target!.placement === 'before' ? `${s.anchor.quote}\n\n` : `\n\n${s.anchor.quote}`});
    }
    current = edits.sort((a,b) => b.from-a.from).reduce((text,e) => text.slice(0,e.from)+e.text+text.slice(e.to), current);
  }
  return current;
}

export const suggestionSignature = (s: LayoutSuggestion) => JSON.stringify([s.kind,s.anchor.quote,s.proposal,s.presentation,s.move_target]);

/** An ignored operation cannot return through another model response. */
export function excludeIgnored(review: LayoutReview, signatures: Set<string>): LayoutReview {
  const removed = new Set(review.suggestions.filter(s => signatures.has(suggestionSignature(s))).map(s => s.id));
  let changed = true;
  while (changed) { changed = false; for (const s of review.suggestions) if (!removed.has(s.id) && s.depends_on.some(id => removed.has(id))) { removed.add(s.id); changed = true; } }
  return { ...review, suggestions: review.suggestions.filter(s => !removed.has(s.id)).map(s => ({ ...s, conflicts_with: s.conflicts_with.filter(id => !removed.has(id)) })) };
}
