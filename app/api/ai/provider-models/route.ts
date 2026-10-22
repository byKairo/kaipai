import { apiConnectionFailure } from '../../../../lib/server-endpoint';
import { AI_PROVIDER_DEFAULTS } from '../../../../lib/providers';
import { NextRequest } from 'next/server';
import { resolveCredential } from '../../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
const NextResponse = { json: (body: unknown, init?: { status?: number }) => privateJson(body, init?.status) };

export const runtime = 'nodejs';

type Provider = 'OpenAI' | 'Anthropic' | 'Gemini' | 'DeepSeek' | 'Qwen' | 'Kimi' | 'Grok';
type Model = { id: string; name: string };

export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 240000);
    const provider = body?.provider as Provider;
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId.trim() : '';
    const region = body?.region === 'international' ? 'international' : 'china';
    if (!['OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi', 'Grok'].includes(provider)) return NextResponse.json({ ok: false, error: '请先填写对应服务的 API Key' }, { status: 400 });
    if (provider === 'Qwen' && !/^[a-zA-Z0-9-]{1,80}$/.test(workspaceId)) return NextResponse.json({ ok: false, error: '请填写有效的百炼业务空间 ID' }, { status: 400 });

    const key = resolveCredential(body.apiKey, { provider, baseUrl: provider === 'Kimi' && region === 'international' ? 'https://api.moonshot.ai/v1' : AI_PROVIDER_DEFAULTS[provider].endpoint, ...(provider === 'Qwen' ? { workspaceId } : {}) });
    if (!key) return NextResponse.json({ ok: false, error: '请填写 API Key' }, { status: 400 });
    // 模型同步仅访问官方固定地址，不把密钥发送到用户填写的自定义地址。
    const url = provider === 'OpenAI' ? 'https://api.openai.com/v1/models'
      : provider === 'Anthropic' ? 'https://api.anthropic.com/v1/models?limit=100'
      : provider === 'Gemini' ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200'
      : provider === 'DeepSeek' ? 'https://api.deepseek.com/models'
      : provider === 'Qwen' ? `https://${workspaceId}.cn-beijing.maas.aliyuncs.com/api/v1/models?providers=qwen&page_size=200`
      : provider === 'Grok' ? 'https://api.x.ai/v1/language-models'
      : region === 'international' ? 'https://api.moonshot.ai/v1/models' : 'https://api.moonshot.cn/v1/models';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: provider === 'Gemini' ? { 'x-goog-api-key': key } : provider === 'Anthropic'
          ? { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
          : { Authorization: `Bearer ${key}` },
        signal: controller.signal,
        redirect: 'manual',
        cache: 'no-store',
      });
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      const error = response.status === 401 || provider === 'Gemini' && response.status === 400 ? '密钥无效或与所选区域不匹配' : response.status === 403 ? '当前密钥没有模型列表权限' : `官方模型列表暂时不可用（${response.status}）`;
      return NextResponse.json({ ok: false, error }, { status: 502 });
    }
    const payload = await response.json();
    const data = provider === 'Gemini' || provider === 'Grok' ? (Array.isArray(payload?.models) ? payload.models : []) : provider === 'Qwen' ? (Array.isArray(payload?.output?.models) ? payload.output.models : []) : (Array.isArray(payload?.data) ? payload.data : []);
    const models: Model[] = data
      .filter((item: unknown): item is { id?: string; model?: string; name?: string; display_name?: string; created?: number; published_time?: string; supportedGenerationMethods?: string[]; inference_metadata?: { response_modality?: string[] } } => Boolean(item && typeof item === 'object' && (typeof (item as { id?: unknown }).id === 'string' || provider === 'Gemini' && typeof (item as { name?: unknown }).name === 'string' || provider === 'Qwen' && typeof (item as { model?: unknown }).model === 'string')))
      .filter((item: { id?: string; model?: string; name?: string; supportedGenerationMethods?: string[]; inference_metadata?: { response_modality?: string[] } }) => provider === 'Gemini' ? /^models\/gemini-/.test(item.name || '') && item.supportedGenerationMethods?.includes('generateContent') && !/(image|audio|live|tts|transcri|embedding)/i.test(item.name || '') : provider === 'Grok' ? /^grok-/.test(item.id || '') && !/(image|video|voice|audio)/i.test(item.id || '') : provider === 'Qwen' ? /^qwen/.test(item.model || '') && (!item.inference_metadata?.response_modality || item.inference_metadata.response_modality.includes('Text')) : provider !== 'OpenAI' || /^gpt-(?:[456](?:\.|-|$))/.test(item.id || '') && !/(audio|realtime|image|search|codex|chat-latest|transcri|tts)/i.test(item.id || ''))
      .sort((a: { created?: number }, b: { created?: number }) => (b.created || 0) - (a.created || 0))
      .slice(0, 100)
      .map((item: { id?: string; model?: string; name?: string; displayName?: string; display_name?: string }) => ({ id: provider === 'Gemini' ? (item.name || '').replace(/^models\//, '') : provider === 'Qwen' ? item.model || '' : item.id || '', name: provider === 'Gemini' ? item.displayName || (item.name || '').replace(/^models\//, '') : item.display_name || item.name || item.model || item.id || '' }));
    return NextResponse.json({ ok: true, models });
  } catch (error) {
    const failure = apiConnectionFailure(error, '读取模型列表');
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
