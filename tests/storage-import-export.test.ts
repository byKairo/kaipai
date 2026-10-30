import assert from 'node:assert/strict';
import * as storage from '../lib/storage';
import { importDocx } from '../lib/importers';
import { makeStandaloneHtml } from '../lib/export';
import { markdownToWechat } from '../lib/wechat-html';
import type { ArticleRecord } from '../lib/document';
import { safeLocalStorage } from '../lib/browser-storage';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}
// Model asynchronous request/transaction completion, including database failures.
function databaseMock(oldArticles?: ArticleRecord[]) {
  const records = new Map<string, Map<string, unknown>>();
  if (oldArticles) {
    records.set('articles', new Map(oldArticles.map(article => [article.id, structuredClone(article)])));
    records.set('drafts', new Map());
  }
  let version = oldArticles ? 4 : 0;
  let failWrites = false, abortWrites = false, blocked = false, failStore = '';
  const connections: any[] = [];
  const reads: string[] = [];
  let migrations = 0;
  const transaction = (names: string[], mode: string, done?: () => void, failed?: () => void) => {
    const staged = new Map<string, Map<string, unknown>>();
    let pending = 0, finished = false;
    const tx: any = {
      abort() { stop('abort'); },
      staged,
    };
    const stop = (event: 'abort' | 'error', request?: any) => {
      if (finished) return;
      finished = true;
      if (event === 'error') { request?.onerror?.(); tx.onerror?.(); }
      else tx.onabort?.();
      failed?.();
    };
    const complete = () => queueMicrotask(() => {
      if (pending || finished) return;
      finished = true;
      for (const [name, store] of Array.from(staged)) records.set(name, store);
      tx.oncomplete?.(); done?.();
    });
    const storeFor = (name: string) => {
      if (mode === 'readonly') return records.get(name)!;
      if (!staged.has(name)) staged.set(name, new Map(records.get(name) || []));
      return staged.get(name)!;
    };
    const requestFor = (name: string, write: boolean, action: () => unknown) => {
      const request: any = {}; pending++;
      queueMicrotask(() => {
        if (finished) return;
        if (write && abortWrites) { stop('abort'); return; }
        if (write && (failWrites || failStore === name)) { stop('error', request); return; }
        request.result = action(); request.onsuccess?.(); pending--; complete();
      });
      return request;
    };
    tx.objectStore = (name: string) => {
      assert.ok(names.includes(name) || mode === 'versionchange', `store ${name} must belong to transaction`);
      return {
        put(value: { id: string }) { return requestFor(name, true, () => { storeFor(name).set(value.id, structuredClone(value)); return value.id; }); },
        delete(id: string) { return requestFor(name, true, () => storeFor(name).delete(id)); },
        get(id: string) { reads.push(`${name}.get:${id}`); return requestFor(name, false, () => structuredClone(storeFor(name).get(id))); },
        getAll() { reads.push(`${name}.getAll`); return requestFor(name, false, () => Array.from(storeFor(name).values()).map(value => structuredClone(value))); },
        openCursor() {
          reads.push(`${name}.openCursor`);
          const values = Array.from(storeFor(name).values());
          const request: any = {}; let index = 0; pending++;
          const advance = () => queueMicrotask(() => {
            if (finished) return;
            request.result = index < values.length ? { value: structuredClone(values[index]), continue() { index++; advance(); } } : null;
            request.onsuccess?.();
            if (!request.result) { pending--; complete(); }
          });
          advance();
          return request;
        },
      };
    };
    complete();
    return tx;
  };
  return {
    records, connections, reads,
    get migrations() { return migrations; },
    setFailWrites(value: boolean) { failWrites = value; },
    setAbortWrites(value: boolean) { abortWrites = value; },
    setBlocked(value: boolean) { blocked = value; },
    setFailStore(value: string) { failStore = value; },
    open(_name: string, requestedVersion: number) {
      const request: any = {};
      request.result = {
        closed: false,
        close() { this.closed = true; },
        objectStoreNames: { contains: (name: string) => records.has(name) || Boolean(request.transaction?.staged.has(name)) },
        createObjectStore(name: string) { request.transaction.staged.set(name, new Map()); return request.transaction.objectStore(name); },
        transaction(names: string | string[], mode: string) { return transaction(typeof names === 'string' ? [names] : names, mode); },
      };
      connections.push(request.result);
      queueMicrotask(() => {
        if (blocked) request.onblocked?.();
        if (requestedVersion > version) {
          migrations++;
          request.transaction = transaction(Array.from(records.keys()), 'versionchange', () => { version = requestedVersion; request.onsuccess?.(); }, () => request.onerror?.());
          request.onupgradeneeded?.();
        } else request.onsuccess?.();
      });
      return request;
    },
  };
}

export async function run() {
  const keys = ['window', 'localStorage', 'sessionStorage', 'indexedDB'] as const;
  const descriptors = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const db = databaseMock();
  const replace = (key: string, value: unknown) => Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  replace('window', {});
  replace('localStorage', local);
  replace('sessionStorage', session);
  replace('indexedDB', db);
  const article: ArticleRecord = { id: 'article-a', title: '完整文章', markdown: '# 完整文章\n\n正文 & 中文 😀', content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '正文 & 中文 😀' }] }] }, style: 'knowledge', createdAt: 1, updatedAt: 2 };
  try {
    assert.equal(await storage.getArticle(), null);
    storage.persistFallbackArticle(article);
    assert.deepEqual(JSON.parse(local.getItem('kaipai.article.fallback.v1')!), article);
    const setItem = local.setItem;
    local.setItem = () => { throw new Error('quota'); };
    assert.throws(() => storage.persistFallbackArticle(article), /quota/);
    await assert.rejects(storage.saveArticle(article), /quota/);
    local.setItem = setItem;
    await storage.saveArticle(article); // IndexedDB unavailable: real fallback path.
    const fallbackB = { ...article, id: 'fallback-b', markdown: 'second offline article', updatedAt: 3 };
    await storage.saveArticle(fallbackB);
    assert.deepEqual((await storage.listArticles()).map(item => item.id), ['fallback-b', 'article-a'], 'consecutive failed saves preserve both articles');
    await storage.saveArticle({ ...article, markdown: 'older version', updatedAt: 1 });
    assert.equal((await storage.getArticle(article.id))?.markdown, article.markdown, 'older fallback saves do not overwrite newer ones');
    assert.equal(await storage.deleteArticle(fallbackB.id), true);
    storage.rememberActiveArticle(article.id);
    assert.deepEqual(await storage.getArticle(), article);
    assert.deepEqual(await storage.listArticles(), [article]);
    assert.equal(await storage.deleteArticle('unknown'), false);
    replace('window', { indexedDB: db });
    assert.deepEqual(await storage.listArticles(), [article]); // recover fallback into DB
    assert.equal(local.getItem('kaipai.article.fallback.v1'), null);
    const updated = { ...article, markdown: article.markdown + '\n修改内容', updatedAt: 5 };
    db.setFailWrites(true);
    await storage.saveArticle(updated);
    assert.deepEqual(await storage.listArticles(), [updated]);
    assert.ok(local.getItem('kaipai.articles.recovery.v1'), 'failed recovery keeps the per-article fallback');
    const updatedB = { ...article, id: 'failed-write-b', updatedAt: 6 };
    await storage.saveArticle(updatedB);
    assert.deepEqual((await storage.listArticles()).map(item => item.id), ['failed-write-b', 'article-a'], 'transaction write failures also preserve multiple documents');
    assert.equal(await storage.deleteArticle(updatedB.id), true);
    db.setFailWrites(false);
    assert.deepEqual(await storage.listArticles(), [updated]);
    assert.equal(local.getItem('kaipai.article.fallback.v1'), null);
    await storage.saveArticle({ ...article, id: 'article-b', updatedAt: 3 });
    assert.deepEqual((await storage.listArticles()).map(item => item.id), ['article-a', 'article-b']);
    assert.equal(await storage.deleteArticle(article.id), true);
    assert.equal(storage.getActiveArticleId(), null);
    assert.equal(await storage.getArticle(article.id), null);
    local.setItem('kaipai.article.fallback.v1', '{broken');
    assert.equal((await storage.listArticles()).length, 1, 'corrupt fallback does not hide DB articles');
    storage.writeSettings({ defaultStyle: 'tech', fontSize: 18 });
    assert.deepEqual(storage.readSettings(), { defaultStyle: 'tech', fontSize: 18 });
    local.setItem('kaipai.settings.v1', 'broken');
    assert.deepEqual(storage.readSettings(), {});
    storage.setSessionValue('draft', article);
    assert.deepEqual(storage.getSessionValue('draft'), article);
    session.setItem('kaipai.session.v1.draft', 'broken');
    assert.equal(storage.getSessionValue('draft'), null);
    for (let index = 0; index < 10; index++) await storage.saveMarkdownDraft({ id: `draft-${index}`, title: '草稿', content: `正文 ${index}`, updatedAt: index });
    const drafts = await storage.listMarkdownDrafts();
    assert.equal(drafts.length, 8);
    assert.equal(drafts[0].content, '正文 9');
    await storage.deleteMarkdownDraft('draft-9');
    assert.equal((await storage.listMarkdownDrafts())[0].id, 'draft-8');
    db.setAbortWrites(true);
    const aborted = { ...article, id: 'aborted-write', updatedAt: 7 };
    await storage.saveArticle(aborted);
    assert.ok((await storage.listArticles()).some(item => item.id === aborted.id), 'transaction abort settles and keeps a recoverable article');
    await assert.rejects(storage.saveMarkdownDraft({ id: 'abort-draft', title: '', content: '', updatedAt: 0 }), /aborted/);
    db.setAbortWrites(false);
    await storage.deleteArticle(aborted.id);
    db.setBlocked(true);
    await storage.saveArticle({ ...article, id: 'blocked-open' });
    assert.ok((await storage.listArticles()).some(item => item.id === 'blocked-open'), 'blocked upgrades fall back instead of hanging');
    let unavailable = '';
    const blockedSummaries = await storage.listArticleSummaries(error => { unavailable = error.message; });
    assert.match(unavailable, /blocked/, 'the UI can distinguish an unavailable database from an empty library');
    assert.ok(blockedSummaries.some(item => item.id === 'blocked-open'));
    db.setBlocked(false);
    await storage.deleteArticle('blocked-open');
    assert.ok(db.connections.every(connection => connection.closed), 'all success, failure, abort and late blocked connections close');
    let closedOnVersionChange = false;
    db.connections[0].close = () => { closedOnVersionChange = true; };
    db.connections[0].onversionchange();
    assert.equal(closedOnVersionChange, true, 'upgrade notifications release the connection');
    replace('window', {});
    const recoveryA = { ...article, id: 'recovery-a', markdown: '最新A', updatedAt: 10 };
    const recoveryB = { ...article, id: 'recovery-b', markdown: '最新B', updatedAt: 11 };
    storage.persistRecoveryArticles([recoveryA, recoveryB]);
    storage.persistRecoveryArticles([{ ...recoveryA, markdown: '旧A', updatedAt: 5 }]);
    assert.deepEqual((await storage.listArticles()).map(item => item.markdown), ['最新B', '最新A']);
    storage.persistFallbackArticle({ ...recoveryA, markdown: '更新A', updatedAt: 12 });
    assert.equal((await storage.listArticles())[0].markdown, '更新A', 'new legacy fallback wins over older bucket checkpoint');
    replace('window', { indexedDB: db });
    db.setFailWrites(true);
    assert.equal((await storage.listArticles())[0].markdown, '更新A');
    assert.ok(local.getItem('kaipai.articles.recovery.v1'), 'failed DB migration preserves both checkpoints');
    db.setFailWrites(false);
    const recovered = await storage.listArticles();
    assert.ok(recovered.some(item => item.id === 'recovery-a' && item.markdown === '更新A'));
    assert.ok(recovered.some(item => item.id === 'recovery-b' && item.markdown === '最新B'));
    assert.equal(local.getItem('kaipai.articles.recovery.v1'), null);
    const newer = { ...recoveryA, markdown: '未来checkpoint', updatedAt: 20 };
    storage.persistRecoveryArticles([newer]);
    await storage.saveArticle({ ...recoveryA, updatedAt: 15 });
    assert.equal(JSON.parse(local.getItem('kaipai.articles.recovery.v1')!)[0].markdown, '未来checkpoint', 'old completed save cannot clear newer checkpoint');
    assert.equal((await storage.listArticles())[0].markdown, '未来checkpoint');
    storage.persistRecoveryArticles([{ ...recoveryB, updatedAt: 30 }]);
    replace('window', {});
    assert.equal(await storage.deleteArticle('recovery-b'), true);
    assert.ok(!(await storage.listArticles()).some(item => item.id === 'recovery-b'), 'offline deletion removes recovery bucket entry');
    local.setItem('kaipai.articles.recovery.v1', '{broken');
    assert.deepEqual(await storage.listArticles(), [], 'corrupt recovery bucket fails gracefully');
    // Migrate actual v4-shaped records, keeping structured JSON, Markdown, style and appearance.
    const oldA = { ...article, id: 'legacy-a', appearance: { accent: '#123456', markerColor: '#ffff00', variant: '标准', fontSize: 16, lineHeight: 1.8, padX: 24, padY: 20, imageRadius: 4, headingStyle: 'bar', headingIcon: '◆', unorderedMarker: 'disc', orderedMarker: 'decimal' } };
    const oldB = { ...article, id: 'legacy-b', markdown: 'second original', updatedAt: 3 };
    const migrationDb = databaseMock([oldA, oldB]);
    const migrationLocal = new MemoryStorage();
    replace('localStorage', migrationLocal);
    replace('indexedDB', migrationDb);
    replace('window', { indexedDB: migrationDb });
    const summaries = await storage.listArticleSummaries();
    assert.deepEqual(summaries, [storage.toArticleSummary(oldB), storage.toArticleSummary(oldA)]);
    assert.deepEqual(migrationDb.records.get('articles')?.get(oldA.id), oldA, 'upgrade leaves original documents byte-for-byte equivalent');
    assert.deepEqual(migrationDb.records.get('articles')?.get(oldB.id), oldB);
    assert.equal(migrationDb.migrations, 1);
    assert.deepEqual(migrationDb.reads, ['articles.openCursor', 'article-summaries.getAll'], 'upgrade scans bodies only once, without getAll');
    migrationDb.reads.length = 0;
    await storage.listArticleSummaries();
    assert.deepEqual(migrationDb.reads, ['article-summaries.getAll'], 'normal list reads never load full article bodies');
    assert.ok(summaries.every(summary => !('content' in summary) && !('markdown' in summary) && !('appearance' in summary)));
    migrationDb.reads.length = 0;
    assert.deepEqual(await storage.getArticle(oldA.id), oldA);
    assert.deepEqual(migrationDb.reads, [`articles.get:${oldA.id}`], 'opening one document reads exactly that primary key');
    assert.equal(await storage.getArticle('unknown-document'), null);
    const nextA = { ...oldA, title: 'updated title', markdown: 'updated original text', updatedAt: 10 };
    migrationDb.setFailStore('article-summaries');
    await storage.saveArticle(nextA);
    assert.deepEqual(migrationDb.records.get('articles')?.get(oldA.id), oldA, 'summary failure rolls back the article body write');
    assert.deepEqual(migrationDb.records.get('article-summaries')?.get(oldA.id), storage.toArticleSummary(oldA));
    assert.ok(migrationLocal.getItem('kaipai.articles.recovery.v1'), 'failed dual write retains recovery');
    assert.deepEqual(await storage.getArticle(oldA.id), nextA, 'single-record reads prefer the newer recoverable document');
    assert.equal((await storage.listArticleSummaries())[0].title, nextA.title, 'summary fallback reflects recoverable edits');
    assert.ok(migrationLocal.getItem('kaipai.articles.recovery.v1'), 'failed restoration cannot clear the checkpoint early');
    migrationDb.setFailStore('');
    await storage.listArticleSummaries();
    assert.deepEqual(migrationDb.records.get('articles')?.get(oldA.id), nextA);
    assert.deepEqual(migrationDb.records.get('article-summaries')?.get(oldA.id), storage.toArticleSummary(nextA));
    assert.equal(migrationLocal.getItem('kaipai.articles.recovery.v1'), null, 'recovery is cleared after both records commit');
    storage.persistRecoveryArticles([{ ...oldA, updatedAt: 1 }]);
    assert.deepEqual(await storage.getArticle(oldA.id), nextA, 'old recovery cannot replace a newer saved document');
    assert.equal(migrationLocal.getItem('kaipai.articles.recovery.v1'), null);
    migrationDb.setFailStore('article-summaries');
    assert.equal(await storage.deleteArticle(oldA.id), false);
    assert.ok(migrationDb.records.get('articles')?.has(oldA.id), 'failed metadata delete cannot leave a half-deleted document');
    assert.ok(migrationDb.records.get('article-summaries')?.has(oldA.id));
    migrationDb.setFailStore('');
    assert.equal(storage.rememberActiveArticle(oldA.id), true);
    const removePreference = migrationLocal.removeItem.bind(migrationLocal);
    migrationLocal.removeItem = key => { if (key === 'kaipai.activeArticle') throw new Error('pointer blocked'); removePreference(key); };
    assert.equal(await storage.deleteArticle(oldA.id), true, 'failed pointer cleanup does not misreport a committed article deletion');
    assert.equal(storage.rememberActiveArticle(null), false);
    assert.equal(migrationDb.records.get('articles')?.has(oldA.id), false);
    assert.equal(migrationDb.records.get('article-summaries')?.has(oldA.id), false);
    assert.deepEqual(await storage.listArticles(), [oldB], 'full list API remains compatible');
    const failedMigration = databaseMock([oldA]);
    failedMigration.setFailStore('article-summaries');
    replace('indexedDB', failedMigration);
    replace('window', { indexedDB: failedMigration });
    let migrationUnavailable = false;
    assert.deepEqual(await storage.listArticleSummaries(() => { migrationUnavailable = true; }), []);
    assert.equal(migrationUnavailable, true);
    assert.deepEqual(failedMigration.records.get('articles')?.get(oldA.id), oldA, 'failed schema migration never damages original bodies');
    assert.equal(failedMigration.records.has('article-summaries'), false, 'failed upgrade rolls back its metadata store');
    failedMigration.setFailStore('');
    assert.deepEqual(await storage.listArticleSummaries(), [storage.toArticleSummary(oldA)], 'upgrade retries safely after a failure');
    assert.equal(failedMigration.migrations, 2);
    replace('localStorage', local);
    assert.equal(safeLocalStorage.setItem('safe-preference', 'saved'), true);
    assert.equal(safeLocalStorage.getItem('safe-preference'), 'saved');
    assert.equal(safeLocalStorage.removeItem('safe-preference'), true);
    assert.equal(safeLocalStorage.getItem('safe-preference'), null);
    const denied = () => { throw new Error('storage blocked'); };
    replace('localStorage', { getItem: denied, setItem: denied, removeItem: denied });
    assert.equal(safeLocalStorage.getItem('preference'), null);
    assert.equal(safeLocalStorage.setItem('preference', 'x'), false);
    assert.equal(safeLocalStorage.removeItem('preference'), false);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: denied });
    assert.equal(safeLocalStorage.getItem('preference'), null, 'storage accessor itself may be blocked');
    assert.equal(safeLocalStorage.setItem('preference', 'x'), false);
    assert.equal(safeLocalStorage.removeItem('preference'), false);
  } finally {
    for (const key of keys) {
      const descriptor = descriptors.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete (globalThis as any)[key];
    }
  }
  const html = markdownToWechat(article.markdown!, '#2563eb');
  const standalone = makeStandaloneHtml(html, `<标题> & "引号"`);
  assert.ok(standalone.includes(`<article>${html}</article>`), 'Export embeds the identical preview/clipboard HTML');
  assert.ok(standalone.includes('<title>&lt;标题&gt; &amp; &quot;引号&quot;</title>'));
  const JSZip = require('jszip');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>导入正文 &amp; 中文 😀</w:t></w:r></w:p></w:body></w:document>');
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  const file = { name: 'article.docx', arrayBuffer: async () => buffer } as File;
  assert.match(await importDocx(file), /导入正文 &amp; 中文 😀/);
  await assert.rejects(importDocx({ ...file, name: 'wrong.txt' } as File), /请选择 .docx/);
  await assert.rejects(importDocx({ ...file, arrayBuffer: async () => new ArrayBuffer(0) } as File), /Word 导入失败/);
  console.log('PASS: v4 metadata migration, bounded article reads, atomic summary/body writes, fallback/recovery, storage failures, DOCX import and unchanged export content');
}
