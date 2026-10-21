// Local preview and a guardrail for AI layouts: keep the author's words while adding Markdown structure.
const headingPattern = /^(?:[一二三四五六七八九十]+[、.]|\d{1,2}[.、｜]|第[一二三四五六七八九十\d]+[章节部分]|背景|原因|方法|步骤|结论|建议|总结|要点|问题)/;
const plain = (text: string) => text.replace(/^(?:[#>*\-]|\d+[.)、])\s*/gm, '').replace(/[*_`=~\[\]]/g, '').replace(/\s/g, '');
const tableRows = (markdown: string) => markdown.split('\n').filter((line) => /^\s*\|.*\|\s*$/.test(line)).map((line) => line.replace(/\s+/g, ' ').trim());

export function normalizeMarkdownTables(markdown: string) {
  return markdown.replace(/(^\s*\|[^\n]+\|\s*\n)(?:[ \t]*\n)+(?=\s*\|)/gm, '$1');
}

export function preservesTables(original: string, proposed: string) {
  const before = tableRows(normalizeMarkdownTables(original));
  if (!before.length) return true;
  const after = tableRows(normalizeMarkdownTables(proposed));
  return before.length === after.length && before.every((row, index) => plain(row) === plain(after[index] || ''));
}

export function displayHeadingWithoutNumber(title: string) {
  return title.replace(/^\s*(?:第[一二三四五六七八九十\d]+[章节部分]|[一二三四五六七八九十\d]{1,3})\s*[｜|、.．:：\-—]\s*/, '').trim() || title;
}

export function normalizeAiHeadingNumbers(markdown: string) {
  return markdown.replace(/^(#{2,3})\s+(.+)$/gm, (_line, hashes: string, title: string) => `${hashes} ${displayHeadingWithoutNumber(title)}`);
}

export function acceptAiLayout(original: string, proposed: string) {
  const next = proposed.trim();
  const source = plain(original);
  const output = plain(next);
  if (!next || !preservesTables(original, next) || output.length < source.length * .75 || output.length > source.length * 1.35) return false;
  const samples = original.split(/\n\s*\n/).map((item) => plain(item).slice(0, 14)).filter((item) => item.length >= 8);
  return samples.length === 0 || samples.filter((item) => output.includes(item)).length >= samples.length * .7;
}

export function suggestMissingElements(markdown: string) {
  const result: string[] = [];
  const images = (markdown.match(/^!\[[^\]]*\]\([^)]+\)/gm) || []).length;
  const sections = (markdown.match(/^##\s/gm) || []).length;
  if (images === 0) result.push('配图｜正文暂无配图，可在核心解释处补一张示意图。');
  else if (images < Math.max(1, Math.floor(sections / 3))) result.push(`配图｜${sections} 个章节仅有 ${images} 张图，可补充关键关系图。`);
  if (!/^:::recs/m.test(markdown)) result.push('文末｜可添加往期推荐，帮助读者继续阅读。');
  if (!/^:::follow/m.test(markdown)) result.push('文末｜可添加引导关注栏，放在正文之后。');
  if (!/^>\s/m.test(markdown) && !/^:::tip/m.test(markdown)) result.push('重点｜可以把一条核心判断提炼为引用或重点卡。');
  return result.slice(0, 4);
}

export function localArticleLayout(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const first = lines.findIndex((line) => line.trim());
  if (first < 0) return markdown;
  if (!/^#\s/.test(lines[first]) && !/^:::\w+/.test(lines[first])) {
    const title = lines[first].trim();
    if (title.length <= 36 && !/[。！？!?；;]/.test(title)) lines[first] = `# ${title}`;
    else lines.splice(first, 0, `# ${title.split(/[。！？!?；;]/)[0].slice(0, 26)}`, '');
  }
  let inFence = false;
  let inBlock = false;
  for (let index = first + 1; index < lines.length; index++) {
    const text = lines[index].trim();
    if (text.startsWith('```')) { inFence = !inFence; continue; }
    if (text.startsWith(':::')) { inBlock = !inBlock; continue; }
    if (inFence || inBlock || !text || /^(?:#|>|\||!\[|[-*+]\s|\d+[.)]\s)/.test(text)) continue;
    const before = index === 0 || !lines[index - 1].trim();
    const after = index === lines.length - 1 || !lines[index + 1].trim();
    if (before && after && text.length <= 28 && !/[。！？!?；;,，]$/.test(text) && headingPattern.test(text)) { lines[index] = `## ${text}`; continue; }
    if (/^[“「].{8,65}[”」]$/.test(text) && before && after) { lines[index] = `> ${text}`; continue; }
    if (/^[（(]?[一二三四五六七八九十]+[、.)）]\s*/.test(text)) { lines[index] = text.replace(/^[（(]?[一二三四五六七八九十]+[、.)）]\s*/, '- '); continue; }
    if (/^\d{1,2}[、）]\s*/.test(text)) { lines[index] = text.replace(/^(\d{1,2})[、）]\s*/, '$1. '); continue; }
    if (!text.includes('==') && /(?:关键在于|核心是|真正重要的是|最重要的是|值得记住的是)/.test(text)) {
      const match = text.match(/(?:关键在于|核心是|真正重要的是|最重要的是|值得记住的是)[^。！？!?]{0,40}/);
      if (match && match[0].length >= 8) lines[index] = lines[index].replace(match[0], `==${match[0]}==`);
    }
  }
  return normalizeAiHeadingNumbers(normalizeMarkdownTables(lines.join('\n')));
}
