import assert from 'node:assert/strict';
import * as storage from '../lib/storage';
import { importDocx } from '../lib/importers';
import { makeStandaloneHtml } from '../lib/export';
import { markdownToWechat } from '../lib/wechat-html';
import type { ArticleRecord } from '../lib/document';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
}
// Model asynchronous request/transaction completion, including database failures.
function databaseMock() {
  const records = new Map<string, Map<string, unknown>>();
  let failWrites = false;
  return {
    records,
    setFailWrites(value: boolean) { failWrites = value; },
    open() {
      const request: any = {};
      request.result = {
        objectStoreNames: { contains: (name: string) => records.has(name) },
        createObjectStore: (name: string) => records.set(name, new Map()),
        transaction(name: string) {
          const tx: any = {};
          const store = records.get(name)!;
          const finish = () => queueMicrotask(() => failWrites ? tx.onerror?.() : tx.oncomplete?.());
          tx.objectStore = () => ({
            put(value: ArticleRecord) { if (!failWrites) store.set(value.id, structuredClone(value)); finish(); },
            delete(id: string) { if (!failWrites) store.delete(id); finish(); },
            getAll() {
              const read: any = {};
              queueMicrotask(() => { read.result = Array.from(store.values()).map(value => structuredClone(value)); read.onsuccess?.(); });
              return read;
            },
          });
          return tx;
        },
      };
      queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
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
    assert.ok(local.getItem('kaipai.article.fallback.v1'), 'failed recovery keeps fallback');
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
  console.log('PASS: article fallback/recovery/write failure/delete, settings/session corruption, draft ordering, real DOCX import and unchanged export content');
}
