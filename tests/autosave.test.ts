import assert from 'node:assert/strict';
import type { ArticleRecord } from '../lib/document';

export async function run() {
  const Module = require('node:module');
  const originalLoad = Module._load;
  const hookFile = require.resolve('../app/workspace/use-article-autosave');
  const cached = require.cache[hookFile];
  delete require.cache[hookFile];
  const saved: ArticleRecord[] = [], reported: string[] = [], deleted: string[] = [];
  let failSave = false, failDelete = false, failCheckpoint = false;
  const checkpoints: ArticleRecord[] = [];
  let gate: Promise<void> | undefined;
  const refs: any[] = [], effects: any[] = [];
  let cursor = 0;
  const timers = new Map<number, () => void>();
  const listeners = new Map<string, () => void>();
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'hidden', addEventListener: (key: string, fn: () => void) => listeners.set(key, fn), removeEventListener: (key: string) => listeners.delete(key) } });
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setTimeout(fn: () => void) { const id = timers.size + 1; timers.set(id, fn); return id; },
    clearTimeout(id: number) { timers.delete(id); },
    addEventListener(key: string, fn: () => void) { listeners.set(key, fn); },
    removeEventListener(key: string) { listeners.delete(key); },
  } });
  Module._load = function(request: string, parent: any, ...rest: any[]) {
    if (parent?.filename === hookFile && request === 'react') return {
      useRef(value: unknown) { const index = cursor++; return refs[index] ?? (refs[index] = { current: value }); },
      useEffect(fn: () => any, deps: unknown[]) {
        const index = cursor++, previous = effects[index];
        if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
          previous?.cleanup?.();
          effects[index] = { deps, cleanup: fn() };
        }
      },
    };
    if (parent?.filename === hookFile && request === '../../lib/storage') return {
      persistRecoveryArticles(articles: ArticleRecord[]) { if (failCheckpoint) throw new Error('quota'); checkpoints.push(...articles); },
      async saveArticle(article: ArticleRecord) { await gate; if (failSave) throw new Error('write failed'); saved.push(article); },
      async deleteArticle(id: string) { if (failDelete) return false; deleted.push(id); return true; },
    };
    return originalLoad.call(this, request, parent, ...rest);
  };
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  const fire = () => { const callbacks = Array.from(timers.values()); timers.clear(); callbacks.forEach(fn => fn()); };
  const article = (id: string, text: string): ArticleRecord => ({ id, title: id, markdown: text, content: { type: 'doc', content: [] }, style: 'knowledge', createdAt: 1, updatedAt: 2 });
  try {
    const { useArticleAutosave } = require(hookFile);
    const render = (value: ArticleRecord | null) => {
      cursor = 0;
      return useArticleAutosave(value, (item: ArticleRecord) => reported.push(item.markdown!), () => reported.push('error'));
    }
    render(article('a', 'old'));
    let actions = render(article('a', 'new'));
    assert.equal(timers.size, 1, 'debounce cancels previous timer');
    fire(); await settle();
    assert.deepEqual(saved.map(item => item.markdown), ['new']);
    render(article('a', 'before switch'));
    render(article('b', 'second article'));
    await settle();
    assert.equal(saved[saved.length - 1].markdown, 'before switch', 'switch flushes previous article');
    fire(); await settle();
    assert.equal(saved[saved.length - 1].id, 'b');
    let release!: () => void;
    gate = new Promise(resolve => { release = resolve; });
    actions = render(article('a', 'queued save'));
    actions.flush(); await settle();
    render(article('a', 'pending delete'));
    const deletion = actions.remove('a');
    fire(); await settle();
    assert.deepEqual(deleted, [], 'deletion waits for started write');
    release(); gate = undefined;
    await deletion; await settle();
    assert.deepEqual(deleted, ['a']);
    assert.ok(!saved.some(item => item.markdown === 'pending delete'), 'deletion discards pending edit');
    failSave = true;
    render(article('c', 'failed')); fire(); await settle();
    assert.equal(reported[reported.length - 1], 'error');
    failSave = false;
    render(article('c', 'recovered')); fire(); await settle();
    assert.equal(saved[saved.length - 1].markdown, 'recovered', 'failed write does not poison queue');
    render(article('c', 'leaving'));
    listeners.get('pagehide')!(); await settle();
    assert.equal(saved[saved.length - 1].markdown, 'leaving');
    failDelete = true;
    await assert.rejects(actions.remove('missing'), /Article deletion failed/);
    await settle();
    assert.equal(reported[reported.length - 1], 'error', 'failed deletion is reported');
    failCheckpoint = true;
    render(article('c', 'quota'));
    listeners.get('pagehide')!();
    assert.equal(reported[reported.length - 1], 'error', 'checkpoint quota failure is reported');
    await settle();
    failCheckpoint = false;
    failDelete = false;
    gate = new Promise(resolve => { release = resolve; });
    actions = render(article('c', 'in flight'));
    actions.flush(); await settle();
    listeners.get('pagehide')!();
    assert.equal(checkpoints[checkpoints.length - 1].markdown, 'in flight', 'pagehide checkpoints even when IDB is in flight');
    assert.notEqual(saved[saved.length - 1].markdown, 'in flight');
    render(article('d', 'switched before close'));
    listeners.get('pagehide')!();
    const lastCheckpoint = checkpoints.slice(-2);
    assert.deepEqual(lastCheckpoint.map(item => item.id), ['c', 'd'], 'switch and immediate pagehide checkpoints both unfinished articles');
    const deletionAfterCheckpoint = actions.remove('c');
    const checkpointCount = checkpoints.length;
    listeners.get('visibilitychange')!();
    assert.ok(checkpoints.slice(checkpointCount).every(item => item.id !== 'c'), 'deleting article is excluded from recovery checkpoint');
    release(); gate = undefined; await deletionAfterCheckpoint; await settle();
    console.log('PASS: autosave debounce, switch flush, sequential delete, failed save recovery and pagehide flush');
  } finally {
    Module._load = originalLoad;
    delete require.cache[hookFile];
    if (cached) require.cache[hookFile] = cached;
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else delete (globalThis as any).document;
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else delete (globalThis as any).window;
  }
}
