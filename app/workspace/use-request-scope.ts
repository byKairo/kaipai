'use client';

import { useEffect, useRef } from 'react';

export function createRequestScopeState() {
  let source = { articleId: '', content: '', generation: 0 };
  const requests = new Map<string, AbortController>();
  const abortAll = () => {
    const pending = Array.from(requests.values());
    requests.clear();
    pending.forEach(controller => controller.abort());
  };
  return {
    update(articleId: string, content: string) {
      if (source.articleId !== articleId || source.content !== content) {
        source.generation += 1;
        abortAll();
      }
      source = { ...source, articleId, content };
    },
    invalidate() { source.generation += 1; abortAll(); },
    cancel(channel: string) {
      const controller = requests.get(channel);
      requests.delete(channel);
      controller?.abort();
    },
    begin(channel: string) {
      const snapshot = { ...source };
      const controller = new AbortController();
      const previous = requests.get(channel);
      requests.set(channel, controller);
      previous?.abort();
      const isCurrent = () => !controller.signal.aborted
        && source.generation === snapshot.generation
        && source.articleId === snapshot.articleId
        && source.content === snapshot.content
        && requests.get(channel) === controller;
      return Object.assign(isCurrent, {
        signal: controller.signal,
        finish() { if (requests.get(channel) === controller) requests.delete(channel); },
      });
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
