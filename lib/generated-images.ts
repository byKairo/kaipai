export type GeneratedImage = { id: string; src: string; brief: string; prompt: string; createdAt: number; cover?: import('./cover-design').CoverRecord };

function openGeneratedImages(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('kaipai-generated-images', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('images', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveGeneratedImage(image: GeneratedImage) {
  const db = await openGeneratedImages();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('images', 'readwrite');
    transaction.objectStore('images').put(image);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function listGeneratedImages(): Promise<GeneratedImage[]> {
  const db = await openGeneratedImages();
  const images = await new Promise<GeneratedImage[]>((resolve, reject) => {
    const request = db.transaction('images', 'readonly').objectStore('images').getAll();
    request.onsuccess = () => resolve(request.result as GeneratedImage[]);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return images.sort((a, b) => b.createdAt - a.createdAt).slice(0, 12);
}
