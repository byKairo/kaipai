import assert from 'node:assert/strict';
import type { GeneratedImage, GeneratedImageCursor, GeneratedImagePage } from '../lib/generated-images';

export async function run() {
  const Module = require('node:module');
  const originalLoad = Module._load;
  const file = require.resolve('../app/workspace/use-generated-image-history');
  const cached = require.cache[file]; delete require.cache[file];
  const slots: any[] = [], effects: Array<() => void> = [];
  let cursor = 0;
  let images: GeneratedImage[] = [];
  const calls: Array<{ cursor?: GeneratedImageCursor; resolve: (page: GeneratedImagePage) => void; reject: (error: Error) => void }> = [];
  const deletions: Array<{ id: string; resolve: () => void; reject: (error: Error) => void }> = [];
  const setImages = (next: GeneratedImage[] | ((current: GeneratedImage[]) => GeneratedImage[])) => { images = typeof next === 'function' ? next(images) : next; };
  const image = (id: string, createdAt: number): GeneratedImage => ({ id, createdAt, src: 'fixture', brief: id, prompt: '' });
  const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  Module._load = function(request: string, parent: any, ...rest: any[]) {
    if (parent?.filename === file && request === 'react') return {
      useRef(value: unknown) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
      useState(value: unknown) { const i = cursor++; if (!(i in slots)) slots[i] = value; return [slots[i], (next: unknown) => { slots[i] = next; }]; },
      useCallback(fn: unknown, _deps: unknown[]) { const i = cursor++; return slots[i] ?? (slots[i] = fn); },
      useEffect(fn: () => () => void, _deps: unknown[]) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn()); } },
    };
    if (parent?.filename === file && request === '../../lib/generated-images') return {
      listGeneratedImagePage(before?: GeneratedImageCursor) { return new Promise<GeneratedImagePage>((resolve, reject) => calls.push({ cursor: before, resolve, reject })); },
      deleteGeneratedImage(id: string) { return new Promise<void>((resolve, reject) => deletions.push({ id, resolve, reject })); },
    };
    return originalLoad.call(this, request, parent, ...rest);
  };
  try {
    const { useGeneratedImageHistory } = require(file);
    const render = () => { cursor = 0; return useGeneratedImageHistory(setImages); };
    let hook = render();
    hook.loadMore(); hook.loadMore();
    assert.equal(calls.length, 1, 'pending initial load rejects overlapping clicks');
    assert.equal(await hook.removeImage('first'), false);
    assert.equal(deletions.length, 0, 'page reads serialize with deletion to prevent stale resurrection');
    const first = image('first', 20), newer = image('new-save', 30);
    images = [newer];
    calls[0].resolve({ images: [first], nextCursor: { id: first.id, createdAt: first.createdAt } });
    await settle(); hook = render();
    assert.deepEqual(images.map(item => item.id), ['new-save', 'first'], 'initial restoration cannot overwrite a concurrently generated image');
    const pending = hook.loadMore();
    hook.loadMore(); assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].cursor, { id: 'first', createdAt: 20 });
    calls[1].reject(new Error('storage temporarily unavailable')); await pending;
    hook = render();
    assert.ok(hook.error && hook.hasMore && !hook.loading);
    assert.equal(images.length, 2, 'failed pagination retains already loaded images');
    const retry = hook.loadMore();
    assert.deepEqual(calls[2].cursor, calls[1].cursor, 'retry uses the unadvanced cursor');
    images = [image('another-save', 40), ...images];
    calls[2].resolve({ images: [first, image('older', 10)], nextCursor: null }); await retry;
    hook = render();
    assert.deepEqual(images.map(item => item.id), ['another-save', 'new-save', 'first', 'older']);
    assert.ok(!hook.hasMore && !hook.loading && !hook.error);
    await hook.loadMore(); assert.equal(calls.length, 3, 'exhausted history stops issuing reads');
    const failedDelete = hook.removeImage('first');
    hook = render();
    assert.equal(hook.deletingId, 'first');
    assert.ok(images.some(item => item.id === 'first'), 'keep the image until the database commits');
    assert.equal(await hook.removeImage('older'), false);
    assert.equal(deletions.length, 1, 'repeated deletion clicks cannot run concurrent writes');
    deletions[0].reject(new Error('delete transaction aborted'));
    assert.equal(await failedDelete, false);
    hook = render();
    assert.ok(hook.deleteError && !hook.deletingId && images.some(item => item.id === 'first'));
    const retryDelete = hook.removeImage('first');
    images = [image('saved-during-deletion', 50), ...images];
    deletions[1].resolve();
    assert.equal(await retryDelete, true);
    hook = render();
    assert.deepEqual(images.map(item => item.id), ['saved-during-deletion', 'another-save', 'new-save', 'older']);
    assert.ok(!hook.deletingId && !hook.deleteError && !hook.hasMore);
    for (const remaining of images.slice()) {
      const removing = hook.removeImage(remaining.id);
      deletions[deletions.length - 1].resolve(); await removing;
    }
    assert.deepEqual(images, [], 'the last archived image can be removed without resetting pagination');
    effects.forEach(dispose => dispose());
    console.log('PASS: history pagination/deletion serialization, saved-image races, commit-only removal, retry without loss and exhaustion');
  } finally {
    Module._load = originalLoad; delete require.cache[file]; if (cached) require.cache[file] = cached;
  }
}
