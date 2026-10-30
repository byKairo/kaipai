import { canonicalCredentialEndpoint, isSealedCredential, LOCAL_CREDENTIAL_PREFIX } from './credential-format';
let pending: Promise<CryptoKey> | undefined;
function browserKey(): Promise<CryptoKey> {
  if (pending) return pending;
  pending = (async () => {
    const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    return new Promise<CryptoKey>((resolve, reject) => {
      const request = indexedDB.open('kaipai-local-credentials', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('keys');
      request.onerror = () => reject(new Error('浏览器无法保存密钥，请允许网站存储后重试'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('keys', 'readwrite');
        const store = tx.objectStore('keys');
        const read = store.get('device');
        let key: CryptoKey;
        read.onsuccess = () => { key = read.result || generated; if (!read.result) store.put(key, 'device'); };
        tx.oncomplete = () => { db.close(); resolve(key); };
        tx.onabort = tx.onerror = () => { db.close(); reject(new Error('本机密钥保存失败')); };
      };
    });
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
const encode = (data: Uint8Array) => btoa(Array.from(data, byte => String.fromCharCode(byte)).join(''));
const decode = (text: string) => Uint8Array.from(atob(text), char => char.charCodeAt(0));
export async function openLocalCredential(value: string, address: string) {
  if (!value.startsWith(LOCAL_CREDENTIAL_PREFIX)) {
    if (isSealedCredential(value)) throw new Error('此连接使用旧版加密方式，请重新填写一次 API Key 并保存，之后无需启动连接程序');
    if (!value.trim()) throw new Error('请填写 API Key');
    return value.trim();
  }
  try {
    const [iv, data] = value.slice(LOCAL_CREDENTIAL_PREFIX.length).split('.');
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(canonicalCredentialEndpoint(address)) }, await browserKey(), decode(data));
    return new TextDecoder().decode(plain);
  } catch { throw new Error('无法读取此地址的本机密钥，请重新填写 API Key 并保存'); }
}
export async function sealLocalCredential(value: string, address: string) {
  const key = await openLocalCredential(value, address);
  if (value.startsWith(LOCAL_CREDENTIAL_PREFIX)) return value;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(canonicalCredentialEndpoint(address)) }, await browserKey(), new TextEncoder().encode(key));
  return `${LOCAL_CREDENTIAL_PREFIX}${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}
