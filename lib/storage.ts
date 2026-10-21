import type { ArticleRecord } from './document';

const DB_NAME = 'kaipai-community';
const STORE_NAME = 'articles';
const DRAFT_STORE_NAME = 'drafts';
const ACTIVE_KEY = 'kaipai.activeArticle';
const SETTINGS_KEY = 'kaipai.settings.v1';
const SESSION_KEY = 'kaipai.session.v1';
const FALLBACK_KEY = 'kaipai.article.fallback.v1';
const RECOVERY_KEY = 'kaipai.articles.recovery.v1';

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
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}

export function rememberActiveArticle(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
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
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const request = indexedDB.open(DB_NAME, 4);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains(DRAFT_STORE_NAME)) request.result.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
  });
}

export type MarkdownDraft = { id: string; title: string; content: string; updatedAt: number };

export async function saveMarkdownDraft(draft: MarkdownDraft) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
    tx.objectStore(DRAFT_STORE_NAME).put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Draft save failed'));
  });
}

export async function listMarkdownDrafts(): Promise<MarkdownDraft[]> {
  const db = await openDatabase();
  return await new Promise<MarkdownDraft[]>((resolve, reject) => {
    const request = db.transaction(DRAFT_STORE_NAME, 'readonly').objectStore(DRAFT_STORE_NAME).getAll();
    request.onsuccess = () => resolve((request.result as MarkdownDraft[]).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8));
    request.onerror = () => reject(request.error || new Error('Draft list failed'));
  });
}

export async function deleteMarkdownDraft(id: string) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
    tx.objectStore(DRAFT_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Draft delete failed'));
  });
}

/** Synchronous recovery checkpoint before the page's asynchronous writes stop. */
export function persistFallbackArticle(article: ArticleRecord) {
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(article));
}

export async function saveArticle(article: ArticleRecord) {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(article);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Article save failed'));
    });
    // Cleanup cannot turn a completed database write into a failed save.
    try { clearRecoveryArticle(article.id, article.updatedAt); } catch {}
  } catch {
    persistFallbackArticle(article);
  }
}

export async function getArticle(id = 'current'): Promise<ArticleRecord | null> {
  const targetId = id === 'current' ? getActiveArticleId() : id;
  if (!targetId) return null;
  return (await listArticles()).find((article) => article.id === targetId) || null;
}

export async function listArticles(): Promise<ArticleRecord[]> {
  const fallback = readFallbackArticle();
  const checkpoints = readRecoveryArticles();
  if (fallback) checkpoints.push(fallback);
  const recovery = new Map<string, ArticleRecord>();
  for (const article of checkpoints) {
    const previous = recovery.get(article.id);
    if (!previous || previous.updatedAt < article.updatedAt) recovery.set(article.id, article);
  }
  try {
    const db = await openDatabase();
    const articles = await new Promise<ArticleRecord[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as ArticleRecord[]);
      request.onerror = () => reject(request.error || new Error('Article list failed'));
    });
    for (const checkpoint of Array.from(recovery.values())) {
      const existing = articles.find((article) => article.id === checkpoint.id);
      if (!existing || checkpoint.updatedAt > existing.updatedAt) {
        articles.splice(existing ? articles.indexOf(existing) : articles.length, existing ? 1 : 0, checkpoint);
        try {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(checkpoint);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Fallback recovery failed'));
          });
          clearRecoveryArticle(checkpoint.id, checkpoint.updatedAt);
        } catch { /* Keep the fallback for the next recovery attempt. */ }
      } else {
        clearRecoveryArticle(checkpoint.id, checkpoint.updatedAt);
      }
    }
    return articles.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return Array.from(recovery.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export async function deleteArticle(id: string) {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Article delete failed'));
    });
    if (getActiveArticleId() === id) rememberActiveArticle(null);
    clearRecoveryArticle(id);
    return true;
  } catch {
    if (readFallbackArticle()?.id !== id && !readRecoveryArticles().some(article => article.id === id)) return false;
    clearRecoveryArticle(id);
    if (getActiveArticleId() === id) rememberActiveArticle(null);
    return true;
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
