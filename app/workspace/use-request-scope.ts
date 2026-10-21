'use client';

import { useEffect, useRef } from 'react';

export function createRequestScopeState() {
  let source = { articleId: '', content: '', generation: 0 };
  const sequences = new Map<string, number>();
  return {
    update(articleId: string, content: string) {
      if (source.articleId !== articleId || source.content !== content) source.generation += 1;
      source = { ...source, articleId, content };
    },
    invalidate() { source.generation += 1; },
    cancel(channel: string) { sequences.set(channel, (sequences.get(channel) || 0) + 1); },
    begin(channel: string) {
      const snapshot = { ...source };
      const sequence = (sequences.get(channel) || 0) + 1;
      sequences.set(channel, sequence);
      return () => source.generation === snapshot.generation
        && source.articleId === snapshot.articleId
        && source.content === snapshot.content
        && sequences.get(channel) === sequence;
    },
  };
}

/** Scope asynchronous results to the article and text they were requested for. */
export function useRequestScope(articleId: string, content: string) {
  const scope = useRef<ReturnType<typeof createRequestScopeState>>();
  if (!scope.current) scope.current = createRequestScopeState();
  scope.current.update(articleId, content);
  useEffect(() => () => { scope.current?.invalidate(); }, []);
  return scope.current;
}
