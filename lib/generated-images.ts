export type GeneratedImage = { id: string; src: string; brief: string; prompt: string; createdAt: number; cover?: import('./cover-design').CoverRecord };

const CREATED_AT_INDEX = 'createdAt';
const RECENT_IMAGE_LIMIT = 12;
export type GeneratedImageCursor = { createdAt: number; id: string };
export type GeneratedImagePage = { images: GeneratedImage[]; nextCursor: GeneratedImageCursor | null };

function openGeneratedImages(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kaipai-generated-images', 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains('images')
        ? request.transaction!.objectStore('images')
        : db.createObjectStore('images', { keyPath: 'id' });
      if (!store.indexNames.contains(CREATED_AT_INDEX)) store.createIndex(CREATED_AT_INDEX, 'createdAt');
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onblocked = () => { blocked = true; reject(new Error('图片库升级被其他标签页占用，请关闭旧页面后重试')); };
    request.onerror = () => reject(request.error || new Error('图片库无法打开'));
  });
}

export async function saveGeneratedImage(image: GeneratedImage, signal?: AbortSignal) {
  const cancelled = () => new DOMException('图片保存已取消', 'AbortError');
  if (signal?.aborted) throw cancelled();
  const db = await openGeneratedImages();
  let abortWrite: (() => void) | undefined;
  try {
    if (signal?.aborted) throw cancelled();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('图片保存失败'));
      transaction.onabort = () => reject(signal?.aborted ? cancelled() : transaction.error || new Error('图片保存已中止'));
      abortWrite = () => {
        try { transaction.abort(); } catch { /* A completed transaction has nothing left to cancel. */ }
      };
      signal?.addEventListener('abort', abortWrite, { once: true });
      const request = transaction.objectStore('images').put(image);
      request.onerror = () => reject(signal?.aborted ? cancelled() : request.error || new Error('图片保存失败'));
    });
  } finally {
    if (abortWrite) signal?.removeEventListener('abort', abortWrite);
    db.close();
  }
}

/** Only delete the selected archive record; article documents embed their own image data. */
export async function deleteGeneratedImage(id: string): Promise<void> {
  const db = await openGeneratedImages();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('图片删除失败'));
      transaction.onabort = () => reject(transaction.error || new Error('图片删除已中止'));
      const request = transaction.objectStore('images').delete(id);
      request.onerror = () => reject(request.error || new Error('图片删除失败'));
    });
  } finally { db.close(); }
}

/** Seek by timestamp and primary key so equal timestamps never skip or repeat an image. */
export async function listGeneratedImagePage(before?: GeneratedImageCursor): Promise<GeneratedImagePage> {
  const db = await openGeneratedImages();
  try {
    return await new Promise<GeneratedImagePage>((resolve, reject) => {
      const images: GeneratedImage[] = [];
      let nextCursor: GeneratedImageCursor | null = null;
      const transaction = db.transaction('images', 'readonly');
      transaction.oncomplete = () => resolve({ images, nextCursor });
      transaction.onerror = () => reject(transaction.error || new Error('图片读取失败'));
      transaction.onabort = () => reject(transaction.error || new Error('图片读取已中止'));
      const store = transaction.objectStore('images');
      // The extra key detects another page without loading a thirteenth full-resolution image.
      const request = store.index(CREATED_AT_INDEX).openKeyCursor(before ? IDBKeyRange.upperBound(before.createdAt) : null, 'prev');
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (before && cursor.key === before.createdAt && indexedDB.cmp(cursor.primaryKey, before.id) >= 0) {
          if (indexedDB.cmp(cursor.primaryKey, before.id) > 0) cursor.continuePrimaryKey(before.createdAt, before.id);
          else cursor.continue();
          return;
        }
        if (images.length === RECENT_IMAGE_LIMIT) {
          const last = images[images.length - 1];
          nextCursor = { createdAt: last.createdAt, id: last.id };
          return;
        }
        const read = store.get(cursor.primaryKey);
        read.onsuccess = () => {
          if (read.result) images.push(read.result as GeneratedImage);
          cursor.continue();
        };
        read.onerror = () => reject(read.error || new Error('图片读取失败'));
      };
      request.onerror = () => reject(request.error || new Error('图片读取失败'));
    });
  } finally { db.close(); }
}

/** Existing callers still receive just the most recent page. */
export async function listGeneratedImages(): Promise<GeneratedImage[]> {
  return (await listGeneratedImagePage()).images;
}
