import { AI_PROVIDER_DEFAULTS, type AiProviderId } from '../../../../lib/providers';
import { NextRequest } from 'next/server';
import { resolveCredential } from '../../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
const NextResponse = { json: (body: unknown, init?: { status?: number }) => privateJson(body, init?.status) };
import { capabilityEndpoint, apiConnectionFailure } from '../../../../lib/server-endpoint';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 240000);
    const provider = body?.provider as AiProviderId;
    const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : '';
    if (!['OpenRouter', 'OpenAI', 'Gemini', 'Grok', 'Custom'].includes(provider)) return NextResponse.json({ ok: false, error: '请填写图片服务的 API Key' }, { status: 400 });
    const key = resolveCredential(body.apiKey, { provider, baseUrl: provider === 'Custom' ? baseUrl : AI_PROVIDER_DEFAULTS[provider].endpoint });
    if (!key) return NextResponse.json({ ok: false, error: '请填写 API Key' }, { status: 400 });
    const url = provider === 'OpenRouter' ? 'https://openrouter.ai/api/v1/images/models'
      : provider === 'OpenAI' ? 'https://api.openai.com/v1/models'
      : provider === 'Gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200'
      : provider === 'Grok' ? 'https://api.x.ai/v1/image-generation-models'
      : await capabilityEndpoint(baseUrl, 'models');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(url, { headers: provider === 'Gemini' ? { 'x-goog-api-key': key } : { Authorization: `Bearer ${key}` }, signal: controller.signal, redirect: 'manual', cache: 'no-store' });
    } finally { clearTimeout(timeout); }
    if (!response.ok) return NextResponse.json({ ok: false, error: `生图模型列表暂时不可用（${response.status}）` }, { status: 502 });
    const payload = await response.json();
    const data = provider === 'Gemini' || provider === 'Grok' ? payload?.models : payload?.data;
    const models = (Array.isArray(data) ? data : [])
      .filter((item: unknown): item is { id?: string; name?: string; displayName?: string; supportedGenerationMethods?: string[]; architecture?: { output_modalities?: string[] } } => Boolean(item && typeof item === 'object'))
      .filter((item: { id?: string; name?: string; supportedGenerationMethods?: string[]; architecture?: { output_modalities?: string[] } }) => provider === 'OpenAI' ? /^(gpt-image-|dall-e-)/.test(item.id || '') : provider === 'Gemini' ? /^models\/gemini-/.test(item.name || '') && /image/i.test(item.name || '') && Boolean(item.supportedGenerationMethods?.includes('generateContent')) : provider === 'Grok' ? /^grok-imagine-image/.test(item.id || '') : provider === 'Custom' ? Boolean(item.architecture?.output_modalities?.includes('image') || /image|flux|seedream|recraft|ideogram|dall-e/i.test(item.id || '')) : Boolean(item.id))
      .slice(0, 100)
      .map((item: { id?: string; name?: string; displayName?: string }) => ({ id: provider === 'Gemini' ? (item.name || '').replace(/^models\//, '') : item.id || '', name: provider === 'Gemini' ? item.displayName || (item.name || '').replace(/^models\//, '') : item.name || item.id || '' }));
    return NextResponse.json({ ok: true, models });
  } catch (error) {
    const failure = apiConnectionFailure(error, '读取生图模型列表');
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
