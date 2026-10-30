'use client';

import { useEffect, useRef } from 'react';
import type { ArticleRecord } from '../../lib/document';
import { deleteArticle, persistRecoveryArticles, saveArticle } from '../../lib/storage';

/** Debounce edits, but flush the previous article before switching or leaving. */
export function useArticleAutosave(article: ArticleRecord | null, onSaved: (article: ArticleRecord) => void, onError: () => void) {
  const pending = useRef<ArticleRecord | null>(null);
  const latest = useRef(article);
  latest.current = article;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const outstanding = useRef(new Map<string, ArticleRecord>());
  const deleting = useRef(new Set<string>());
  const callbacks = useRef({ onSaved, onError });
  callbacks.current = { onSaved, onError };
  const flush = () => {
    const snapshot = pending.current;
    if (!snapshot) return queue.current;
    pending.current = null;
    outstanding.current.set(snapshot.id, snapshot);
    // Serialize writes so an older IndexedDB operation cannot win over newer edits.
    queue.current = queue.current.then(() => saveArticle(snapshot)).then(() => {
      if (outstanding.current.get(snapshot.id) === snapshot) outstanding.current.delete(snapshot.id);
      callbacks.current.onSaved(snapshot);
    }).catch(() => callbacks.current.onError());
    return queue.current;
  };
  useEffect(() => {
    if (pending.current && pending.current.id !== article?.id) flush();
    pending.current = article;
    if (!article) return;
    const timer = window.setTimeout(flush, 650);
    return () => window.clearTimeout(timer);
  }, [article]);
  useEffect(() => {
    const onPageHide = () => {
      const snapshots = new Map(outstanding.current);
      for (const snapshot of [pending.current, latest.current]) {
        if (!snapshot) continue;
        const existing = snapshots.get(snapshot.id);
        if (!existing || snapshot.updatedAt >= existing.updatedAt) snapshots.set(snapshot.id, snapshot);
      }
      try { persistRecoveryArticles(Array.from(snapshots.values()).filter((snapshot) => !deleting.current.has(snapshot.id))); }
      catch { callbacks.current.onError(); }
      flush();
    };
    const onVisibilityChange = () => { if (document.visibilityState === 'hidden') onPageHide(); };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { window.removeEventListener('pagehide', onPageHide); document.removeEventListener('visibilitychange', onVisibilityChange); flush(); };
  }, []);
  const remove = (id: string) => {
    deleting.current.add(id);
    if (pending.current?.id === id) pending.current = null;
    if (latest.current?.id === id) latest.current = null;
    const deletion = queue.current.then(async () => {
      if (!await deleteArticle(id)) throw new Error('Article deletion failed');
      outstanding.current.delete(id);
      deleting.current.delete(id);
    });
    queue.current = deletion.then(() => undefined).catch(() => { deleting.current.delete(id); callbacks.current.onError(); });
    return deletion;
  };
  return { flush, remove };
}
