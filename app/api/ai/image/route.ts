import { readResponseJson, RESPONSE_LIMITS } from '../../../../lib/response-body';
import { buildDesignPrompt } from '../../../../lib/server/skills';
import { NextRequest } from 'next/server';
import { resolveCredential } from '../../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
const NextResponse = { json: (body: unknown, init?: { status?: number }) => privateJson(body, init?.status) };
import { buildImageRequestBody, pickOpenAiImageSrc } from '../../../../lib/ai-protocol';
import { AI_PROVIDER_DEFAULTS, type AiProviderId } from '../../../../lib/providers';
import { capabilityEndpoint, apiConnectionFailure, validateImageDownload } from '../../../../lib/server-endpoint';

export const runtime = 'nodejs';

function imageError(status: number) { return `配图接口返回 ${status}，请检查模型权限、余额和接口支持的请求格式`; }

async function imageUrlToDataUrl(src: string, signal: AbortSignal) {
  if (src.startsWith('data:image/')) return src;
  const url = await validateImageDownload(src);
  const response = await fetch(url, { signal, redirect: 'manual', cache: 'no-store' });
  if (!response.ok) throw new Error(`图片地址读取失败：${response.status}`);
  const contentType = response.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) throw new Error('图片地址没有返回图片内容');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('图片内容为空');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 24 * 1024 * 1024) { await reader.cancel(); throw new Error('图片过大'); }
    chunks.push(value);
  }
  const bytes = Buffer.concat(chunks);
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 240000);
    const provider = body?.provider as AiProviderId;
    const rawPrompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
    if (rawPrompt.length > 12000) return NextResponse.json({ ok: false, error: '画面要求过长，请缩短后重试' }, { status: 413 });
    const prompt = body.action === 'test' ? rawPrompt : rawPrompt ? buildDesignPrompt(rawPrompt, body.design) : '';
    const model = typeof body?.model === 'string' ? body.model.trim() : '';
    const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : '';
    const adapter = body?.adapter === 'antigravity-gemini-image-chat' || body?.adapter === 'gemini-native' || body?.adapter === 'openai-images' ? body.adapter : provider === 'Gemini' && baseUrl.includes('generativelanguage.googleapis.com') ? 'gemini-native' : /^gemini-.*image/i.test(model) ? 'antigravity-gemini-image-chat' : 'openai-images';
    const aspectRatio = typeof body.aspectRatio === 'string' && ['2.35:1', '1:1', '4:3', '9:16'].includes(body.aspectRatio) ? body.aspectRatio : '';
    const nativeRatio = aspectRatio === '2.35:1' ? '21:9' : aspectRatio;
    const testing = body?.action === 'test';
    if (!prompt || !model || model.length > 120) return NextResponse.json({ ok: false, error: '请先配置配图模型、API Key 和画面内容' }, { status: 400 });
    if (!['OpenRouter', 'OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi', 'Grok', 'Custom'].includes(provider)) return NextResponse.json({ ok: false, error: '请选择图片服务' }, { status: 400 });
    const key = resolveCredential(body.apiKey, { provider, baseUrl: baseUrl || (provider === 'Custom' ? '' : AI_PROVIDER_DEFAULTS[provider].endpoint) });
    if (!key) return NextResponse.json({ ok: false, error: '请填写 API Key' }, { status: 400 });
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    if (request.signal.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      let response: Response;
      const defaultBase = provider === 'Custom' ? '' : AI_PROVIDER_DEFAULTS[provider].endpoint.replace(/\/chat\/completions$/, '');
      if (adapter !== 'gemini-native') {
        const imageRequest = buildImageRequestBody({ model, prompt, adapter, aspectRatio });
        const endpoint = adapter === 'antigravity-gemini-image-chat' ? await capabilityEndpoint(baseUrl || defaultBase, 'chat/completions') : provider === 'OpenRouter' && (!baseUrl || baseUrl === defaultBase) ? 'https://openrouter.ai/api/v1/images' : provider !== 'Custom' && (!baseUrl || baseUrl === defaultBase) ? AI_PROVIDER_DEFAULTS[provider].endpoint.replace(/chat\/completions$/, 'images/generations') : await capabilityEndpoint(baseUrl, 'images/generations');
        response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(imageRequest.body), signal: controller.signal, redirect: 'manual', cache: 'no-store' });
        if (!response.ok) {
          return NextResponse.json({ ok: false, error: imageError(response.status) }, { status: 502 });
        }
        const payload = await readResponseJson(response, RESPONSE_LIMITS.image);
        const image = adapter === 'antigravity-gemini-image-chat' ? payload?.choices?.[0]?.message?.images?.[0] : payload?.data?.[0];
        const src = pickOpenAiImageSrc(image || {});
        if (typeof src !== 'string' || !src) return NextResponse.json({ ok: false, error: '模型没有返回图片' }, { status: 502 });
        const stableSrc = await imageUrlToDataUrl(src, controller.signal);
        if (testing) return NextResponse.json({ ok: true, model });
        const generationRatio = imageRequest.generationRatio;
        return NextResponse.json({ ok: true, src: stableSrc, generationRatio });
      }
      if (baseUrl !== 'https://generativelanguage.googleapis.com/v1beta/openai') return NextResponse.json({ ok: false, error: 'Gemini 官方原生接口只能搭配 Gemini 官方 API 地址和 Key；本地代理请选 Gemini Image（聊天接口）' }, { status: 400 });
      if (!/^[a-zA-Z0-9_.-]+$/.test(model)) return NextResponse.json({ ok: false, error: 'Gemini 模型 ID 格式不正确' }, { status: 400 });
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(nativeRatio ? { imageConfig: { aspectRatio: nativeRatio } } : {}) } }), signal: controller.signal, redirect: 'manual', cache: 'no-store' });
      if (!response.ok) {
        return NextResponse.json({ ok: false, error: imageError(response.status) }, { status: 502 });
      }
      const payload = await readResponseJson(response, RESPONSE_LIMITS.image);
      const part = payload?.candidates?.flatMap((candidate: { content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }) => candidate.content?.parts || []).find((item: { inlineData?: { data?: string } }) => item.inlineData?.data);
      if (!part?.inlineData?.data) return NextResponse.json({ ok: false, error: '模型没有返回图片' }, { status: 502 });
      if (testing) return NextResponse.json({ ok: true, model });
      return NextResponse.json({ ok: true, src: `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`, generationRatio: nativeRatio });
    } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); }
  } catch (error) {
    const failure = apiConnectionFailure(error, '配图请求');
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
