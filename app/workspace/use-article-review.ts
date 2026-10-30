'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { getArticleReviewController, parseArticleSuggestions, type ArticleSuggestion, type ReviewState } from '../../lib/article-review-client';
import { requestAi, type AiRequest } from '../../lib/providers';
import type { useRequestScope } from './use-request-scope';

type Options = {
  content: string; articleId: string; editorRef: MutableRefObject<Editor | null>;
  scope: ReturnType<typeof useRequestScope>; connection: AiRequest | null;
  configure: () => void; say: (message: string) => void;
};
const signature = (item: ArticleSuggestion) => JSON.stringify([item.kind, item.quote, item.prefix, item.suffix]);

export function useArticleReview({ content, articleId, editorRef, scope, connection, configure, say }: Options) {
  const [review, setReview] = useState<ReviewState>({ items: [], activeId: null });
  const [phase, setPhase] = useState<'idle' | 'running' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const ignored = useRef(new Set<string>());
  const active = review.items.find(item => item.id === review.activeId) || null;

  useEffect(() => {
    if (phase === 'running') { scope.cancel('article-review'); setPhase('idle'); setMessage('正文已变化，请重新检查。'); }
  }, [content, articleId]);

  function reset() {
    scope.cancel('article-review'); ignored.current.clear(); setPhase('idle'); setMessage('');
    const editor = editorRef.current;
    if (editor && !editor.isDestroyed) getArticleReviewController(editor.view)?.clear();
    setReview({ items: [], activeId: null });
  }
  function select(id: string | null, scroll = false) {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    getArticleReviewController(editor.view)?.select(id, scroll);
  }
  async function run() {
    const editor = editorRef.current;
    if (!editor || !editor.getText().trim()) { say('请先输入文章内容'); return; }
    if (!connection || !connection.apiKey.trim()) { say('AI 检查需连接文章模型；本地排版无需 API。'); configure(); return; }
    const snapshot = editor.state.doc;
    const isCurrent = scope.begin('article-review');
    setPhase('running'); setMessage('');
    getArticleReviewController(editor.view)?.clear();
    try {
      let suggestions: ArticleSuggestion[];
      const result = await requestAi({ ...connection, operation: 'review', article: content, prompt: '' }, isCurrent.signal);
      if (!isCurrent()) return;
      if (!result.ok) throw new Error(result.error);
      suggestions = parseArticleSuggestions(JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
      if (!isCurrent() || editor.isDestroyed || editorRef.current !== editor || !editor.state.doc.eq(snapshot)) return;
      const choices = suggestions.filter(item => !ignored.current.has(signature(item)));
      const controller = getArticleReviewController(editor.view);
      if (!controller) return;
      const items = controller.locate(choices);
      controller.set(items);
      setPhase('ready');
      setMessage(items.length ? `${items.length} 处建议，点击正文虚线查看。`
        : choices.length ? '建议未能准确定位，原文未修改；可重新检查。' : suggestions.length ? '其余建议已忽略，原文保持不变。' : '这次没有提出修改建议。');
    } catch (error) {
      if (!isCurrent()) return;
      setPhase('error'); setMessage(error instanceof SyntaxError ? '模型返回的建议格式无法识别，请重试。' : error instanceof Error ? error.message : '检查未完成，请重试。');
    } finally { isCurrent.finish(); }
  }
  function adopt() {
    const editor = editorRef.current;
    if (!editor || !active) return;
    if (!getArticleReviewController(editor.view)?.adopt(active.id)) { say('这处内容需要确认或已经变化，请重新检查'); return; }
    say('已采用，可用撤销恢复');
  }
  function dismiss() {
    const editor = editorRef.current;
    if (!editor || !active) return;
    ignored.current.add(signature(active));
    getArticleReviewController(editor.view)?.dismiss(active.id);
  }
  function next() {
    if (!review.items.length) return;
    const at = review.items.findIndex(item => item.id === review.activeId);
    select(review.items[(at + 1) % review.items.length].id, true);
  }
  function cancel() { scope.cancel('article-review'); setPhase('idle'); setMessage('已取消检查，原文未修改。'); }
  return { review, setReview, phase, message, active, run, adopt, dismiss, next, select, reset, cancel };
}
