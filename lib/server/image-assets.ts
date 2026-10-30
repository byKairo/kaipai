import { boundedResponseChunks, readResponseJson } from '../response-body';
import type { ImageAssetBindings } from './image-assets-runtime';

export const MAX_ARTICLE_IMAGE_BYTES = 24 * 1024 * 1024;
const COOKIE = '__Host-kaipai-image-upload';
export class ImageAssetError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function imageAssetsReady(env: ImageAssetBindings) {
  return Boolean(env.bucket && env.limiter && env.siteKey && env.turnstileSecret && (env.sessionSecret?.length || 0) >= 32);
}
function configured(env: ImageAssetBindings) {
  if (!imageAssetsReady(env)) throw new ImageAssetError('图片存储尚未接通，请稍后重试；原文与图片未改变', 503);
}
async function signature(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
}
async function limit(env: ImageAssetBindings, ip: string) {
  if (!ip || !(await env.limiter!.limit({ key: `image:${ip}` })).success) throw new ImageAssetError('图片准备请求较多，请稍后重试', 429);
}
export async function createImageUploadSession(env: ImageAssetBindings, token: string, hostname: string, ip: string, verify = fetch) {
  configured(env);
  await limit(env, ip);
  if (!token || token.length > 2048) throw new ImageAssetError('请完成图片上传验证', 403);
  const response = await verify('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: new URLSearchParams({ secret: env.turnstileSecret!, response: token, remoteip: ip }), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new ImageAssetError('图片上传验证暂时不可用，请重试', 502);
  const result = await readResponseJson(response, 32768);
  if (!result.success || result.hostname !== hostname || result.action !== 'article-images') throw new ImageAssetError('图片上传验证未通过，请重试', 403);
  const expiry = Date.now() + 10 * 60 * 1000;
  const value = `${expiry}.${await signature(env.sessionSecret!, `${hostname}|${ip}|${expiry}`)}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=600`;
}
export async function uploadArticleImage(env: ImageAssetBindings, request: Request, ip: string) {
  configured(env);
  await limit(env, ip);
  const hostname = new URL(request.url).hostname;
  const value = (request.headers.get('cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) || '';
  const [expiry, mac, extra] = value.split('.');
  if (extra || !/^\d{13}$/.test(expiry || '') || !/^[a-f0-9]{64}$/.test(mac || '') || Number(expiry) <= Date.now() || Number(expiry) > Date.now() + 600000) throw new ImageAssetError('图片上传验证已过期，请重试', 401);
  const expected = await signature(env.sessionSecret!, `${hostname}|${ip}|${expiry}`);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  if (difference) throw new ImageAssetError('图片上传验证无效，请重试', 401);
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!['image/png', 'image/jpeg'].includes(type)) throw new ImageAssetError('请上传 PNG 或 JPEG 图片', 415);
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    for await (const part of boundedResponseChunks(new Response(request.body, { headers: request.headers }), MAX_ARTICLE_IMAGE_BYTES)) { parts.push(part); size += part.byteLength; }
  } catch { throw new ImageAssetError('图片读取失败或超过 24 MiB，请缩小后重试', 413); }
  if (!size) throw new ImageAssetError('图片文件为空');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  const png = [137,80,78,71,13,10,26,10].every((byte, i) => bytes[i] === byte);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png' ? !png : !jpeg) throw new ImageAssetError('图片格式与文件内容不符', 415);
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  const key = `${hash}.${png ? 'png' : 'jpg'}`;
  // Immutable content-addressed objects: retries and duplicate positions do not create more objects.
  if (!await env.bucket!.head(key)) await env.bucket!.put(key, bytes, { httpMetadata: { contentType: type } });
  return { url: `${new URL(request.url).origin}/api/article-assets/${key}` };
}
