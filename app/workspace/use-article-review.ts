'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { applyArticleSuggestion, articleReviewKey, localReviewDemo, locateArticleSuggestions, parseArticleSuggestions, reviewTransaction, type ArticleSuggestion, type ReviewState } from '../../lib/article-review';
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
    if (editor && !editor.isDestroyed) editor.view.dispatch(reviewTransaction(editor.state, { type: 'set', items: [] }));
    setReview({ items: [], activeId: null });
  }
  function select(id: string | null, scroll = false) {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const tr = reviewTransaction(editor.state, { type: 'select', id });
    const item = articleReviewKey.getState(editor.state)?.items.find(item => item.id === id);
    if (scroll && item) tr.setSelection(TextSelection.create(editor.state.doc, item.from, item.to)).scrollIntoView();
    editor.view.dispatch(tr);
  }
  async function run() {
    const editor = editorRef.current;
    if (!editor || !editor.getText().trim()) { say('请先输入文章内容'); return; }
    if (connection && !connection.apiKey.trim()) { configure(); return; }
    const snapshot = editor.state.doc;
    const isCurrent = scope.begin('article-review');
    setPhase('running'); setMessage('');
    editor.view.dispatch(reviewTransaction(editor.state, { type: 'set', items: [] }));
    try {
      let suggestions: ArticleSuggestion[];
      if (!connection) {
        await new Promise(resolve => window.setTimeout(resolve, 250));
        suggestions = localReviewDemo(snapshot);
      } else {
        const result = await requestAi({ ...connection, operation: 'review', article: content, prompt: '' });
        if (!result.ok) throw new Error(result.error);
        suggestions = parseArticleSuggestions(JSON.parse(result.text.replace(/^```(?:json)?\s*|\s*```$/g, '')));
      }
      if (!isCurrent() || editor.isDestroyed || editorRef.current !== editor || !editor.state.doc.eq(snapshot)) return;
      const choices = suggestions.filter(item => !ignored.current.has(signature(item)));
      const items = locateArticleSuggestions(editor.state.doc, choices);
      editor.view.dispatch(reviewTransaction(editor.state, { type: 'set', items }));
      setPhase('ready');
      setMessage(items.length ? `${!connection ? '本地演示 · ' : ''}${items.length} 处建议，点击正文虚线查看。`
        : choices.length ? '建议未能准确定位，原文未修改；可重新检查。' : suggestions.length ? '其余建议已忽略，原文保持不变。' : '这次没有提出修改建议。');
    } catch (error) {
      if (!isCurrent()) return;
      setPhase('error'); setMessage(error instanceof SyntaxError ? '模型返回的建议格式无法识别，请重试。' : error instanceof Error ? error.message : '检查未完成，请重试。');
    }
  }
  function adopt() {
    const editor = editorRef.current;
    if (!editor || !active) return;
    const tr = applyArticleSuggestion(editor.state, active.id);
    if (!tr) { say('这处内容需要确认或已经变化，请重新检查'); return; }
    // One review choice is one undo step, separate from adjacent typing/choices.
    editor.view.dispatch(closeHistory(tr));
    editor.view.dispatch(closeHistory(editor.state.tr).setMeta('addToHistory', false));
    editor.view.focus(); say('已采用，可用撤销恢复');
  }
  function dismiss() {
    const editor = editorRef.current;
    if (!editor || !active) return;
    ignored.current.add(signature(active));
    editor.view.dispatch(reviewTransaction(editor.state, { type: 'remove', id: active.id }));
    editor.view.focus();
  }
  function next() {
    if (!review.items.length) return;
    const at = review.items.findIndex(item => item.id === review.activeId);
    select(review.items[(at + 1) % review.items.length].id, true);
  }
  function cancel() { scope.cancel('article-review'); setPhase('idle'); setMessage('已取消检查，原文未修改。'); }
  return { review, setReview, phase, message, active, run, adopt, dismiss, next, select, reset, cancel };
}
