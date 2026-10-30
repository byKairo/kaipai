import { identifyApiAddress } from './api-setup';
import { isLocalApi } from './ai-transport';
import { parseModelDirectory } from './model-discovery';
import { openLocalCredential, sealLocalCredential } from './local-credential';
import { buildTextRequestBody, buildImageRequestBody, pickOpenAiImageSrc } from './ai-protocol';
import { readChatResponse, readResponsesResponse } from './server/chat-response';
import { localAuthHeader, localConnectionFailure, localPermissionState, loopbackOptions } from './local-api-access';
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
type Body = Record<string, any>;
/** Only known workflow data crosses the public server boundary, never the local key/address. */
async function workflow(phase: string, body: Body, signal: AbortSignal, text?: string) {
  const response = await fetch('/api/ai/local-workflow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ phase, operation: body.operation, article: body.article, preferences: body.preferences, design: body.design, image: body.image, prompt: body.prompt, text }) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.error || '任务准备失败');
  return data;
}
async function upstream(url: string, init: RequestInit, key?: string, authHeader: 'Authorization' | 'X-Api-Key' = 'Authorization') {
  let response: Response;
  const headers = new Headers(init.headers);
  if (key) headers.set(authHeader, authHeader === 'Authorization' ? `Bearer ${key}` : key);
  const options = { ...init, headers, credentials: 'omit' as const, redirect: 'manual' as const, cache: 'no-store' as const };
  try { response = await fetch(url, isLocalApi(url) ? loopbackOptions(options) : options); }
  catch (error) {
    if (init.signal?.aborted) throw error;
    throw await localConnectionFailure();
  }
  if (!response.ok) throw new Error(response.status === 401 ? '本地 API 的 Key 无效（401），请核对后重试' : `本地 API 返回 ${response.status}，请检查模型权限与接口支持`);
  return response;
}
async function stableImage(src: string, signal: AbortSignal) {
  if (/^data:image\/(png|jpeg|webp);base64,/.test(src)) return src;
  const url = new URL(src);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('图片地址无效');
  // Never send the API credential to a returned image URL.
  const response = await upstream(url.toString(), { signal });
  if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('图片地址未返回图片');
  const blob = await response.blob();
  if (blob.size > 24 * 1024 * 1024) throw new Error('图片超过 24 MB');
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('无法读取生成图片')); reader.readAsDataURL(blob); });
}
export async function localAiFetch(path: string, body: Body, signal?: AbortSignal): Promise<Response> {
  const base = identifyApiAddress(String(body.baseUrl || body.endpoint || '')).baseUrl;
  if (!isLocalApi(base)) throw new Error('本地直连仅用于本机地址');
  if (path === '/api/credentials/seal') return json({ ok: true, credential: await sealLocalCredential(String(body.apiKey || ''), base) });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, path === '/api/ai/connection-models' ? 15000 : 240000);
  try {
    const key = await openLocalCredential(String(body.apiKey || ''), base);
    if (await localPermissionState() === 'denied') throw await localConnectionFailure();
    const authHeader = await localAuthHeader(base, controller.signal);
    if (path === '/api/ai/connection-models') {
      const response = await upstream(`${base}/models`, { signal: controller.signal }, key, authHeader);
      return json({ ok: true, models: parseModelDirectory(await response.json()), source: 'connection', fetchedAt: new Date().toISOString() });
    }
    const post = (endpoint: string, data: unknown) => upstream(`${base}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal }, key, authHeader);
    const model = String(body.model || '').trim();
    if (!model) throw new Error('请选择模型');
    if (path === '/api/ai') {
      const prepared = body.action === 'test' ? { prompt: '只回复：连接成功', system: '你正在进行连接测试。' } : body.operation ? await workflow('text', body, controller.signal) : { prompt: body.prompt, system: body.system || '你是楷排的中文内容编辑助手。' };
      const limit = body.action === 'test' ? 384 : 10000;
      const responses = body.adapter === 'openai-responses';
      const response = await post(responses ? 'responses' : 'chat/completions', buildTextRequestBody({ provider: body.provider, model, adapter: responses ? 'openai-responses' : 'openai-chat', system: prepared.system, prompt: prepared.prompt, image: prepared.image, maxOutputTokens: limit }));
      const text = responses ? await readResponsesResponse(response) : await readChatResponse(response);
      if (!text?.trim()) throw new Error('模型未返回可用内容');
      const review = body.operation === 'design-review' && body.action !== 'test' ? (await workflow('review', body, controller.signal, text)).review : undefined;
      return json({ ok: true, text, model, review });
    }
    if (path === '/api/ai/image') {
      const prompt = body.action === 'test' ? body.prompt : (await workflow('image', body, controller.signal)).prompt;
      if (body.adapter === 'gemini-native') throw new Error('本机 Gemini 图片模型请使用兼容的聊天接口');
      const chat = body.adapter === 'antigravity-gemini-image-chat';
      const imageRequest = buildImageRequestBody({ model, prompt, adapter: chat ? 'antigravity-gemini-image-chat' : 'openai-images', aspectRatio: body.aspectRatio });
      const response = await post(chat ? 'chat/completions' : 'images/generations', imageRequest.body);
      const raw = await response.json();
      const image = chat ? raw.choices?.[0]?.message?.images?.[0] : raw.data?.[0];
      const src = pickOpenAiImageSrc(image);
      if (!src) throw new Error('模型未返回图片');
      const stable = await stableImage(src, controller.signal);
      return json(body.action === 'test' ? { ok: true, model } : { ok: true, src: stable, generationRatio: imageRequest.generationRatio });
    }
    throw new Error('此操作暂不支持本地直连');
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new Error('本地 API 响应超时，请重试或更换模型');
    if (error instanceof Error && ['IncompleteChatStream', 'ChatOutputLimit', 'ChatContentFiltered'].includes(error.message)) throw new Error('模型回复中断或被截断，未应用不完整结果，请重试');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', cancel); }
}
