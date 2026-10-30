import type { ArticleRecord } from './document';
import { safeLocalStorage } from './browser-storage';

const DB_NAME = 'kaipai-community';
const STORE_NAME = 'articles';
const SUMMARY_STORE_NAME = 'article-summaries';
const DRAFT_STORE_NAME = 'drafts';
const ACTIVE_KEY = 'kaipai.activeArticle';
const SETTINGS_KEY = 'kaipai.settings.v1';
const SESSION_KEY = 'kaipai.session.v1';
const FALLBACK_KEY = 'kaipai.article.fallback.v1';
const RECOVERY_KEY = 'kaipai.articles.recovery.v1';

export type ArticleSummary = Pick<ArticleRecord, 'id' | 'title' | 'style' | 'createdAt' | 'updatedAt'>;

export function toArticleSummary(article: ArticleRecord): ArticleSummary {
  const { id, title, style, createdAt, updatedAt } = article;
  return { id, title, style, createdAt, updatedAt };
}

function readRecoveryArticles(): ArticleRecord[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECOVERY_KEY) || '[]');
    return Array.isArray(value) ? value.filter((article): article is ArticleRecord =>
      article && typeof article.id === 'string' && typeof article.updatedAt === 'number' && article.content?.type === 'doc') : [];
  } catch { return []; }
}

/** Preserve all outstanding articles synchronously when the browser is leaving. */
export function persistRecoveryArticles(articles: ArticleRecord[]) {
  const records = new Map(readRecoveryArticles().map(article => [article.id, article]));
  for (const article of articles) {
    const existing = records.get(article.id);
    if (!existing || existing.updatedAt <= article.updatedAt) records.set(article.id, article);
  }
  localStorage.setItem(RECOVERY_KEY, JSON.stringify(Array.from(records.values())));
}

function clearRecoveryArticle(id: string, through = Infinity) {
  const records = readRecoveryArticles();
  const remaining = records.filter(article => article.id !== id || article.updatedAt > through);
  if (records.length !== remaining.length) {
    if (remaining.length) localStorage.setItem(RECOVERY_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(RECOVERY_KEY);
  }
  const fallback = readFallbackArticle();
  if (fallback?.id === id && fallback.updatedAt <= through) localStorage.removeItem(FALLBACK_KEY);
}

function readFallbackArticle(): ArticleRecord | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FALLBACK_KEY) || 'null');
    if (!value || typeof value !== 'object') return null;
    const article = value as ArticleRecord;
    return typeof article.id === 'string' && typeof article.updatedAt === 'number' && article.content?.type === 'doc' ? article : null;
  } catch { return null; }
}

export function getActiveArticleId(): string | null {
  return safeLocalStorage.getItem(ACTIVE_KEY);
}

export function rememberActiveArticle(id: string | null): boolean {
  return id ? safeLocalStorage.setItem(ACTIVE_KEY, id) : safeLocalStorage.removeItem(ACTIVE_KEY);
}

export type LocalSettings = {
  defaultStyle?: string;
  accentColor?: string;
  fontSize?: number;
  lineHeight?: number;
  paragraphGap?: number;
  memory?: Record<string, unknown>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 5);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(DRAFT_STORE_NAME)) db.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SUMMARY_STORE_NAME)) {
        const summaries = db.createObjectStore(SUMMARY_STORE_NAME, { keyPath: 'id' });
        // One migration pass; later list reads never materialize article bodies.
        // Both schema and metadata commit with the upgrade, leaving original documents intact.
        const cursorRequest = request.transaction!.objectStore(STORE_NAME).openCursor();
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) return;
          summaries.put(toArticleSummary(cursor.value as ArticleRecord));
          cursor.continue();
        };
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    // An old tab can hold an upgrade open indefinitely. Fall back now and close
    // the late connection if that tab eventually releases it.
    request.onblocked = () => { blocked = true; reject(new Error('IndexedDB upgrade blocked by another tab')); };
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

async function withTransaction<T>(names: string | string[], mode: IDBTransactionMode, operation: (tx: IDBTransaction) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      try {
        const request = operation(tx);
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally { db.close(); }
}

function withStore<T>(name: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return withTransaction(name, mode, tx => operation(tx.objectStore(name)));
}

async function writeArticleRecord(article: ArticleRecord) {
  await withTransaction([STORE_NAME, SUMMARY_STORE_NAME], 'readwrite', tx => {
    tx.objectStore(STORE_NAME).put(article);
    return tx.objectStore(SUMMARY_STORE_NAME).put(toArticleSummary(article));
  });
}

function recoveryById(): Map<string, ArticleRecord> {
  const checkpoints = readRecoveryArticles();
  const fallback = readFallbackArticle();
  if (fallback) checkpoints.push(fallback);
  const recovery = new Map<string, ArticleRecord>();
  for (const article of checkpoints) {
    const previous = recovery.get(article.id);
    if (!previous || previous.updatedAt < article.updatedAt) recovery.set(article.id, article);
  }
  return recovery;
}

async function restoreCheckpoint(checkpoint: ArticleRecord) {
  try {
    await writeArticleRecord(checkpoint);
    clearRecoveryArticle(checkpoint.id, checkpoint.updatedAt);
  } catch { /* Keep the checkpoint until both the document and its summary have committed. */ }
}

export type MarkdownDraft = { id: string; title: string; content: string; updatedAt: number };

export async function saveMarkdownDraft(draft: MarkdownDraft) {
  await withStore(DRAFT_STORE_NAME, 'readwrite', store => store.put(draft));
}

export async function listMarkdownDrafts(): Promise<MarkdownDraft[]> {
  const drafts = await withStore(DRAFT_STORE_NAME, 'readonly', store => store.getAll()) as MarkdownDraft[];
  return drafts.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
}

export async function deleteMarkdownDraft(id: string) {
  await withStore(DRAFT_STORE_NAME, 'readwrite', store => store.delete(id));
}

/** Synchronous recovery checkpoint before the page's asynchronous writes stop. */
export function persistFallbackArticle(article: ArticleRecord) {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(article));
}

export async function saveArticle(article: ArticleRecord) {
  try {
    await writeArticleRecord(article);
    // Cleanup cannot turn a completed database write into a failed save.
    try { clearRecoveryArticle(article.id, article.updatedAt); } catch {}
  } catch {
    // A single fallback slot loses A when saving B during an IndexedDB failure.
    // Keep every document by id; the old slot remains readable for migration.
    persistRecoveryArticles([article]);
  }
}

export async function getArticle(id = 'current'): Promise<ArticleRecord | null> {
  const targetId = id === 'current' ? getActiveArticleId() : id;
  if (!targetId) return null;
  const checkpoint = recoveryById().get(targetId);
  try {
    const article = await withStore(STORE_NAME, 'readonly', store => store.get(targetId)) as ArticleRecord | undefined;
    if (checkpoint && (!article || checkpoint.updatedAt > article.updatedAt)) {
      await restoreCheckpoint(checkpoint);
      return checkpoint;
    }
    if (checkpoint) {
      try { clearRecoveryArticle(targetId, checkpoint.updatedAt); } catch { /* Cleanup cannot hide a saved document. */ }
    }
    return article || null;
  } catch { return checkpoint || null; }
}

/** Load only the sidebar fields; v4 bodies are scanned once during the v5 upgrade. */
export async function listArticleSummaries(onUnavailable?: (error: Error) => void): Promise<ArticleSummary[]> {
  const recovery = recoveryById();
  try {
    const saved = await withStore(SUMMARY_STORE_NAME, 'readonly', store => store.getAll()) as ArticleSummary[];
    const summaries = new Map(saved.map(summary => [summary.id, summary]));
    for (const checkpoint of Array.from(recovery.values())) {
      const existing = summaries.get(checkpoint.id);
      if (!existing || checkpoint.updatedAt > existing.updatedAt) {
        summaries.set(checkpoint.id, toArticleSummary(checkpoint));
        await restoreCheckpoint(checkpoint);
      } else {
        try { clearRecoveryArticle(checkpoint.id, checkpoint.updatedAt); } catch { /* Keep readable summaries on cleanup failure. */ }
      }
    }
    return Array.from(summaries.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (error) {
    onUnavailable?.(error instanceof Error ? error : new Error('文稿库暂时无法读取'));
    return Array.from(recovery.values()).map(toArticleSummary).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

/** Full records remain available for compatibility and explicit bulk export. */
export async function listArticles(): Promise<ArticleRecord[]> {
  const recovery = recoveryById();
  try {
    const saved = await withStore(STORE_NAME, 'readonly', store => store.getAll()) as ArticleRecord[];
    const articles = new Map(saved.map(article => [article.id, article]));
    for (const checkpoint of Array.from(recovery.values())) {
      const existing = articles.get(checkpoint.id);
      if (!existing || checkpoint.updatedAt > existing.updatedAt) {
        articles.set(checkpoint.id, checkpoint);
        await restoreCheckpoint(checkpoint);
      } else {
        try { clearRecoveryArticle(checkpoint.id, checkpoint.updatedAt); } catch { /* A cleanup failure must not hide saved articles. */ }
      }
    }
    return Array.from(articles.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return Array.from(recovery.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export async function deleteArticle(id: string) {
  try {
    await withTransaction([STORE_NAME, SUMMARY_STORE_NAME], 'readwrite', tx => {
      tx.objectStore(STORE_NAME).delete(id);
      return tx.objectStore(SUMMARY_STORE_NAME).delete(id);
    });
    if (getActiveArticleId() === id) rememberActiveArticle(null);
    clearRecoveryArticle(id);
    return true;
  } catch {
    if (readFallbackArticle()?.id !== id && !readRecoveryArticles().some(article => article.id === id)) return false;
    // Do not report success after deleting only a recovery copy: an older
    // database record would reappear as soon as IndexedDB becomes available.
    try {
      const saved = await withStore(STORE_NAME, 'readonly', store => store.get(id));
      if (saved) return false;
      clearRecoveryArticle(id);
      if (getActiveArticleId() === id) rememberActiveArticle(null);
      return true;
    } catch { return false; }
  }
}

export function readSettings(): LocalSettings {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch { return {}; }
}

export function writeSettings(settings: LocalSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function setSessionValue(key: string, value: unknown) {
  sessionStorage.setItem(`${SESSION_KEY}.${key}`, JSON.stringify(value));
}

export function getSessionValue<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(`${SESSION_KEY}.${key}`) || 'null') as T | null; } catch { return null; }
}
