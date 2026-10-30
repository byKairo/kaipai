import assert from 'node:assert/strict';

export function run() {
  const Module = require('node:module');
  const originalLoad = Module._load;
  const hookFile = require.resolve('../app/workspace/use-persisted-settings');
  const cachedHook = require.cache[hookFile];
  delete require.cache[hookFile];
  const descriptors = new Map(['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map<string, string>([['style', 'saved-style'], ['accent', '#112233']]);
  const writes: Array<[string, string]> = [];
  const attempts: Array<[string, string]> = [];
  const deniedKeys = new Set<string>();
  const errors: string[] = [];
  const timers = new Map<number, () => void>();
  const listeners = new Map<string, () => void>();
  const slots: any[] = [];
  const effectSlots = new Set<number>();
  let cursor = 0;
  let timerId = 0;
  const documentStub = {
    visibilityState: 'visible',
    addEventListener: (type: string, listener: () => void) => listeners.set(`document:${type}`, listener),
    removeEventListener: (type: string) => listeners.delete(`document:${type}`),
  };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: documentStub });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    setTimeout(callback: () => void, delay: number) {
      assert.equal(delay, 180);
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id: number) { timers.delete(id); },
    addEventListener: (type: string, listener: () => void) => listeners.set(`window:${type}`, listener),
    removeEventListener: (type: string) => listeners.delete(`window:${type}`),
  } });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem(key: string) { return storage.get(key) ?? null; },
    setItem(key: string, value: string) {
      attempts.push([key, value]);
      if (deniedKeys.has(key)) throw new Error('Storage quota exceeded');
      storage.set(key, value);
      writes.push([key, value]);
    },
    removeItem(key: string) { storage.delete(key); },
  } });
  const changed = (before: unknown[] | undefined, after: unknown[]) => !before || after.length !== before.length || after.some((value, index) => !Object.is(value, before[index]));
  Module._load = function(request: string, parent: any, ...rest: any[]) {
    if (parent?.filename === hookFile && request === 'react') return {
      useRef(value: unknown) {
        const index = cursor++;
        return slots[index] ?? (slots[index] = { current: value });
      },
      useCallback(callback: () => void, deps: unknown[]) {
        const index = cursor++;
        if (changed(slots[index]?.deps, deps)) slots[index] = { callback, deps };
        return slots[index].callback;
      },
      useEffect(effect: () => void | (() => void), deps: unknown[]) {
        const index = cursor++;
        effectSlots.add(index);
        if (changed(slots[index]?.deps, deps)) {
          slots[index]?.cleanup?.();
          slots[index] = { deps, cleanup: effect() };
        }
      },
    };
    return originalLoad.call(this, request, parent, ...rest);
  };
  const fireTimers = () => {
    const pending = Array.from(timers.values());
    timers.clear();
    pending.forEach(callback => callback());
  };
  const pagehide = () => listeners.get('window:pagehide')!();
  const visibility = (state: 'visible' | 'hidden') => {
    documentStub.visibilityState = state;
    listeners.get('document:visibilitychange')!();
  };
  let unmounted = false;
  const unmount = () => {
    if (unmounted) return;
    unmounted = true;
    effectSlots.forEach(index => slots[index]?.cleanup?.());
  };
  try {
    const { usePersistedSettings } = require(hookFile);
    const render = (values: Record<string, string>, ready = true, message = 'first handler') => {
      cursor = 0;
      usePersistedSettings(values, ready, () => errors.push(message));
    };

    render({ style: 'default-style', accent: '#ffffff' }, false);
    fireTimers(); pagehide(); visibility('hidden');
    assert.deepEqual(attempts, [], 'Defaults must not overwrite stored preferences before restoration is ready');
    assert.equal(storage.get('style'), 'saved-style');

    render({ style: 'saved-style', accent: '#112233' });
    fireTimers();
    assert.deepEqual(attempts, [], 'Restored values already in storage need no redundant write');

    for (const fontSize of ['16', '17', '18']) render({ style: 'saved-style', accent: '#112233', fontSize });
    assert.equal(timers.size, 1, 'Rapid changes coalesce into one pending save');
    assert.deepEqual(attempts, []);
    fireTimers();
    assert.deepEqual(writes, [['fontSize', '18']], 'Only the final slider value is saved');
    render({ style: 'saved-style', accent: '#112233', fontSize: '18' });
    fireTimers();
    assert.equal(writes.length, 1, 'New render objects do not rewrite unchanged keys');
    render({ style: 'saved-style', accent: '#445566', fontSize: '18' });
    fireTimers();
    assert.deepEqual(writes.at(-1), ['accent', '#445566']);
    assert.equal(writes.length, 2, 'An isolated preference change writes only that key');

    deniedKeys.add('accent');
    render({ style: 'saved-style', accent: '#778899', fontSize: '19' });
    assert.doesNotThrow(fireTimers, 'Failed persistence must not interrupt the editing UI');
    assert.equal(storage.get('fontSize'), '19', 'A failed key must not block saving another preference');
    assert.equal(storage.get('accent'), '#445566', 'Failed key retains its last persisted value');
    assert.deepEqual(errors, ['first handler']);
    const successfulCount = writes.length;
    pagehide(); visibility('hidden');
    assert.equal(errors.length, 1, 'Repeated flushes of the same failure do not repeat the warning');
    assert.equal(writes.length, successfulCount, 'Successfully saved keys are not rewritten while another key retries');

    deniedKeys.clear();
    pagehide();
    assert.equal(storage.get('accent'), '#778899', 'Pending preference can be saved after storage recovers');
    assert.equal(errors.length, 1);
    deniedKeys.add('accent');
    render({ style: 'saved-style', accent: '#abcdef', fontSize: '19' }, true, 'latest handler');
    fireTimers();
    assert.deepEqual(errors, ['first handler', 'latest handler'], 'A new failure after recovery warns using the latest callback');
    deniedKeys.clear();
    pagehide();
    assert.equal(storage.get('accent'), '#abcdef');

    render({ style: 'saved-style', accent: '#abcdef', fontSize: '20' });
    pagehide();
    assert.equal(storage.get('fontSize'), '20', 'pagehide flushes the latest state before debounce fires');
    const afterPageHide = writes.length;
    fireTimers();
    assert.equal(writes.length, afterPageHide, 'Debounce after pagehide does not duplicate writes');
    render({ style: 'saved-style', accent: '#abcdef', fontSize: '21' });
    visibility('visible');
    assert.equal(storage.get('fontSize'), '20', 'Visible changes do not force a save');
    visibility('hidden');
    assert.equal(storage.get('fontSize'), '21', 'Hiding the document flushes pending preferences');

    render({ style: 'saved-style', accent: '#abcdef', fontSize: '22' });
    unmount();
    assert.equal(storage.get('fontSize'), '22', 'Unmount persists the final preference value');
    assert.equal(timers.size, 0, 'Unmount cancels the pending debounce');
    assert.equal(listeners.size, 0, 'Unmount removes page lifecycle listeners');
    console.log('PASS: settings restore gate, coalescing, changed keys, recoverable failures, warning deduplication and lifecycle flush');
  } finally {
    unmount();
    Module._load = originalLoad;
    delete require.cache[hookFile];
    if (cachedHook) require.cache[hookFile] = cachedHook;
    for (const [key, descriptor] of Array.from(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
}
