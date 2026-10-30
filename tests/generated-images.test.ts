import assert from 'node:assert/strict';
import { deleteGeneratedImage, listGeneratedImages, listGeneratedImagePage, saveGeneratedImage, type GeneratedImage } from '../lib/generated-images';

function databaseMock(initial: GeneratedImage[], fresh = false) {
  const records = new Map(initial.map(image => [image.id, structuredClone(image)]));
  const indexes = new Set<string>();
  let version = fresh ? 0 : 1;
  let storeExists = !fresh;
  let onWrite: (() => void) | undefined;
  let abort = false, fail = false, blocked = false;
  let visited = 0, getAllCalls = 0, upgrades = 0;
  const connections: any[] = [];
  const controls = {
    records, connections,
    cmp(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; },
    onWrite(callback?: () => void) { onWrite = callback; },
    get visited() { return visited; },
    get getAllCalls() { return getAllCalls; },
    get upgrades() { return upgrades; },
    setAbort(value: boolean) { abort = value; },
    setFail(value: boolean) { fail = value; },
    setBlocked(value: boolean) { blocked = value; },
    open(_name: string, requestedVersion: number) {
      visited = 0;
      const request: any = {};
      const makeStore = (tx: any) => ({
        indexNames: { contains: (name: string) => indexes.has(name) },
        createIndex(name: string, keyPath: string) { assert.equal(keyPath, 'createdAt'); indexes.add(name); },
        getAll() { getAllCalls++; throw new Error('unexpected full image scan'); },
        delete(id: string) {
          const remove: any = {};
          queueMicrotask(() => {
            if (abort || tx.aborted) { tx.onabort?.(); return; }
            if (fail) { remove.onerror?.(); return; }
            records.delete(id); tx.oncomplete?.();
          });
          return remove;
        },
        get(id: string) {
          const read: any = {};
          tx.waitingForGet = true;
          queueMicrotask(() => {
            tx.waitingForGet = false;
            if (abort || tx.aborted) { tx.onabort?.(); return; }
            if (fail) { read.onerror?.(); return; }
            visited++;
            read.result = structuredClone(records.get(id)); read.onsuccess?.();
          });
          return read;
        },
        put(image: GeneratedImage) {
          const write: any = {};
          onWrite?.();
          queueMicrotask(() => {
            if (abort || tx.aborted) { tx.onabort?.(); return; }
            if (fail) { write.onerror?.(); return; }
            records.set(image.id, structuredClone(image)); tx.oncomplete?.();
          });
          return write;
        },
        index(name: string) {
          assert.ok(indexes.has(name));
          return {
            openKeyCursor(query: { upper: number } | null, direction: string) {
              assert.equal(direction, 'prev');
              const values = Array.from(records.values()).filter(image => !query || image.createdAt <= query.upper).sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
              const cursorRequest: any = {};
              let position = 0;
              const next = () => queueMicrotask(() => {
                if (abort || tx.aborted) { tx.onabort?.(); return; }
                if (fail) { cursorRequest.onerror?.(); return; }
                let continued = false;
                cursorRequest.result = position < values.length ? {
                  get value() { throw new Error('Key cursors must not materialize image bodies'); },
                  key: values[position].createdAt,
                  primaryKey: values[position].id,
                  continuePrimaryKey(key: number, id: string) {
                    continued = true;
                    do { position++; } while (position < values.length && (values[position].createdAt > key || (values[position].createdAt === key && values[position].id > id)));
                    next();
                  },
                  continue() { continued = true; position++; next(); },
                } : null;
                cursorRequest.onsuccess?.();
                if (!continued && !tx.waitingForGet) tx.oncomplete?.();
              });
              next();
              return cursorRequest;
            },
          };
        },
      });
      request.result = {
        closed: false,
        close() { this.closed = true; },
        objectStoreNames: { contains: (name: string) => storeExists && name === 'images' },
        createObjectStore() { assert.equal(storeExists, false, 'must preserve existing v1 store'); storeExists = true; return makeStore({}); },
        transaction() { const tx: any = { abort() { this.aborted = true; } }; tx.objectStore = () => makeStore(tx); return tx; },
      };
      request.transaction = request.result.transaction();
      connections.push(request.result);
      queueMicrotask(() => {
        if (blocked) request.onblocked?.();
        if (requestedVersion > version) { upgrades++; request.onupgradeneeded?.(); version = requestedVersion; }
        request.onsuccess?.();
      });
      return request;
    },
  };
  return controls;
}

export async function run() {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const originalRange = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange');
  Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: { upperBound: (upper: number) => ({ upper }) } });
  const images = Array.from({ length: 100 }, (_, index): GeneratedImage => ({ id: `image-${index}`, src: `data:image/png;base64,original-${index}`, brief: `brief ${index}`, prompt: `prompt ${index}`, createdAt: index }));
  const db = databaseMock(images);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: db });
  try {
    const recent = await listGeneratedImages();
    assert.deepEqual(recent.map(image => image.id), images.slice(-12).reverse().map(image => image.id));
    assert.deepEqual(recent, images.slice(-12).reverse(), 'original image data and metadata are unchanged');
    assert.equal(db.records.size, 100, 'upgrading never removes old images');
    assert.equal(db.upgrades, 1, 'v1 database receives the new time index');
    assert.equal(db.visited, 12, 'only the latest twelve full image records are materialized');
    assert.equal(db.getAllCalls, 0);
    const archive: GeneratedImage[] = [];
    let page = await listGeneratedImagePage();
    while (true) {
      assert.ok(page.images.length <= 12 && db.visited <= 12);
      archive.push(...page.images);
      if (!page.nextCursor) break;
      page = await listGeneratedImagePage(page.nextCursor);
    }
    assert.deepEqual(archive, images.slice().reverse(), 'all old image bodies and metadata remain reachable once each');
    const tied = Array.from({ length: 25 }, (_, index) => ({ ...images[0], id: `tie-${String(index).padStart(2, '0')}`, createdAt: 50 }));
    const ties = databaseMock(tied);
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: ties });
    const first = await listGeneratedImagePage();
    assert.equal(first.images.length, 12);
    ties.records.delete(first.nextCursor!.id); // A deleted boundary must still work.
    await saveGeneratedImage({ ...images[0], id: 'new-during-pagination', createdAt: 99 });
    const second = await listGeneratedImagePage(first.nextCursor!);
    const third = await listGeneratedImagePage(second.nextCursor!);
    assert.equal(second.images.length, 12);
    assert.equal(third.images.length, 1);
    assert.equal(third.nextCursor, null);
    assert.deepEqual([...first.images, ...second.images, ...third.images].map(image => image.id), tied.slice().reverse().map(image => image.id), 'ties, deleted cursor and newer inserts neither skip nor duplicate old images');
    const exact = databaseMock(images.slice(0, 12));
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: exact });
    assert.equal((await listGeneratedImagePage()).nextCursor, null, 'an exact-size final page has no extra load-more step');
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: db });
    const newest = { ...images[0], id: 'newest', createdAt: 101 };
    await saveGeneratedImage(newest);
    assert.equal((await listGeneratedImages())[0].id, newest.id);
    assert.equal(db.records.size, 101, 'saving does not trim the archive');
    await deleteGeneratedImage('image-0');
    assert.equal(db.records.has('image-0'), false);
    assert.deepEqual(db.records.get('image-1'), images[1], 'deleting one image preserves every other original');
    assert.equal(db.visited, 0, 'deleting a record does not load full image data');
    await deleteGeneratedImage('already-removed');
    assert.equal(db.records.size, 100, 'deleting an absent record is harmless');
    db.setAbort(true);
    await assert.rejects(deleteGeneratedImage('image-1'), /中止/);
    db.setAbort(false);
    db.setFail(true);
    await assert.rejects(deleteGeneratedImage('image-1'), /失败/);
    db.setFail(false);
    assert.deepEqual(db.records.get('image-1'), images[1], 'aborted and failed deletion never loses the original');
    assert.equal(db.upgrades, 1, 'existing v2 database does not repeat migration');
    const alreadyCancelled = new AbortController(); alreadyCancelled.abort();
    const opensBeforeCancel = db.connections.length;
    await assert.rejects(saveGeneratedImage({ ...newest, id: 'cancelled-before-open' }, alreadyCancelled.signal), { name: 'AbortError' });
    assert.equal(db.connections.length, opensBeforeCancel, 'already-cancelled work never opens the database');
    const duringOpen = new AbortController();
    const opening = saveGeneratedImage({ ...newest, id: 'cancelled-opening' }, duringOpen.signal);
    duringOpen.abort();
    await assert.rejects(opening, { name: 'AbortError' });
    const duringWrite = new AbortController();
    db.onWrite(() => duringWrite.abort());
    await assert.rejects(saveGeneratedImage({ ...newest, id: 'cancelled-writing' }, duringWrite.signal), { name: 'AbortError' });
    db.onWrite();
    assert.equal(db.records.has('cancelled-opening'), false);
    assert.equal(db.records.has('cancelled-writing'), false, 'cancelling an active transaction rolls back its image');
    db.setAbort(true);
    await assert.rejects(saveGeneratedImage({ ...newest, id: 'aborted' }), /中止/);
    await assert.rejects(listGeneratedImages(), /中止/);
    assert.equal(db.records.has('aborted'), false);
    db.setAbort(false);
    db.setFail(true);
    await assert.rejects(saveGeneratedImage({ ...newest, id: 'failed' }), /失败/);
    await assert.rejects(listGeneratedImages(), /失败/);
    db.setFail(false);
    db.setBlocked(true);
    await assert.rejects(listGeneratedImages(), /其他标签页/);
    db.setBlocked(false);
    assert.ok(db.connections.every(connection => connection.closed), 'success, error, abort and late blocked connections all close');
    let closedOnVersionChange = false;
    db.connections[0].close = () => { closedOnVersionChange = true; };
    db.connections[0].onversionchange();
    assert.equal(closedOnVersionChange, true);
    db.records.clear();
    assert.deepEqual(await listGeneratedImages(), []);
    await saveGeneratedImage(newest);
    assert.deepEqual(await listGeneratedImages(), [newest]);
    const fresh = databaseMock([], true);
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fresh });
    await saveGeneratedImage(newest);
    assert.deepEqual(await listGeneratedImages(), [newest], 'first-time visitors get both the store and index');
    assert.ok(fresh.connections.every(connection => connection.closed));
    console.log('PASS: image v1 migration, bounded reads, original archive retention and transaction/open failure cleanup');
  } finally {
    if (originalRange) Object.defineProperty(globalThis, 'IDBKeyRange', originalRange);
    else delete (globalThis as any).IDBKeyRange;
    if (original) Object.defineProperty(globalThis, 'indexedDB', original);
    else delete (globalThis as any).indexedDB;
  }
}
