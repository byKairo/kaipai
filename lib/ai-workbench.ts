import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Selection } from '@tiptap/pm/state';

export type ImageScope = 'cover' | 'selection' | 'article';
export type AiPlanOptions = { styleId?: string; imageScope?: ImageScope; imageInstruction?: string };
export type ImageTarget = { articleId: string; from: number; to: number; insertAt: number; text: string; sourceText: string; sourceSize: number };

/** Keep a paragraph image tied to the block the user was editing, not a later cursor. */
export function captureImageTarget(doc: ProseMirrorNode, selection: Selection, articleId: string): ImageTarget | undefined {
  const { $from, $to, empty } = selection;
  let depth = $from.depth;
  while (depth > 0 && !$from.node(depth).isTextblock) depth--;
  if (!depth) return;
  let endDepth = $to.depth;
  while (endDepth > 0 && !$to.node(endDepth).isTextblock) endDepth--;
  if (!endDepth) return;
  const from = empty ? $from.start(depth) : selection.from;
  const to = empty ? $from.end(depth) : selection.to;
  const text = doc.textBetween(from, to, '\n').trim();
  if (!text) return;
  // Insert beside a top-level block, rather than inside a paragraph/list/table.
  const insertAt = $to.after(1);
  return { articleId, from, to, insertAt, text, sourceText: doc.textBetween(0, doc.content.size, '\n', '\uFFFC'), sourceSize: doc.content.size };
}

export function isImageTargetCurrent(doc: ProseMirrorNode, target: ImageTarget, articleId: string) {
  return target.articleId === articleId && target.sourceSize === doc.content.size
    && target.sourceText === doc.textBetween(0, doc.content.size, '\n', '\uFFFC') && target.from >= 0 && target.to <= doc.content.size
    && target.insertAt <= doc.content.size
    && doc.textBetween(target.from, target.to, '\n').trim() === target.text;
}

export function imageScopePreference(scope: ImageScope, target?: ImageTarget) {
  if (scope === 'cover') return '只构思一张文章封面，用途必须标为封面。';
  if (scope === 'selection') return `只构思一张正文插图，围绕下面的段落，不生成封面；图片将在该段落所在内容块之后插入。段落内容：${target?.text || ''}`;
  return '为整篇文章推荐最多三张正文插图，标明对应章节；封面由独立封面流程处理，本次不生成封面。';
}

export function scopedImageBriefs(briefs: string[], scope: ImageScope, target?: ImageTarget) {
  const fallback = scope === 'selection' ? `正文｜解释这段内容：${target?.text.slice(0, 160) || ''}` : '封面｜提炼文章核心判断';
  const source = briefs.length ? briefs : [fallback];
  if (scope === 'article') {
    const body = source.filter(brief => !brief.startsWith('封面')).slice(0, 3);
    return body.length ? body : ['正文｜解释文章中需要图示的关键关系'];
  }
  const chosen = source.find(brief => scope === 'cover' ? brief.startsWith('封面') : !brief.startsWith('封面')) || (scope === 'cover' ? source[0] : fallback);
  const prompt = chosen.includes('｜') ? chosen.split('｜').slice(1).join('｜') : chosen;
  return [`${scope === 'cover' ? '封面' : '正文'}｜${prompt}`];
}
