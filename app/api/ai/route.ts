import { buildSkillPlan, finishCoverReview } from '../../../lib/server/skills';
import { NextRequest } from 'next/server';
import { resolveCredential } from '../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../lib/server/request';
const NextResponse = { json: (body: unknown, init?: { status?: number }) => privateJson(body, init?.status) };
import { AI_PROVIDER_DEFAULTS, type AiProviderId } from '../../../lib/providers';
import { capabilityEndpoint, apiConnectionFailure } from '../../../lib/server-endpoint';

export const runtime = 'nodejs';

function upstreamError(status: number, provider: AiProviderId) {
  const name = provider === 'Anthropic' ? 'Claude' : provider;
  if (status === 401) return `${name} 身份验证失败（401）。请确认 API Key 与当前 API 地址匹配，且仍然有效。${provider === 'Kimi' ? 'Kimi 会员或 Kimi Code 密钥不能用于 Kimi 开放平台；中国站和国际站的密钥也要匹配接口地址。' : ''}`;
  if (status === 403) return `${name} 拒绝访问（403）。请检查账户是否有该模型的使用权限。`;
  if (status === 404) return `${name} 未找到模型或接口（404）。请核对模型 ID；若是自定义接口，还要检查 API 地址。`;
  if (status === 429) return `${name} 请求受限（429）。请检查速率限制或账户余额，稍后再试。`;
  if (status === 400 || status === 422) return `${name} 无法接受当前请求（${status}）。请核对模型 ID 与该模型支持的参数。`;
  return `${name} 服务返回 ${status}，请稍后重试。`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 17000000);
    const reviewingImage = body.operation === 'design-review' && body.action !== 'test';
    if (!reviewingImage && JSON.stringify(body).length > 240000) return NextResponse.json({ ok: false, error: '请求内容过长' }, { status: 413 });
    const provider = body?.provider as AiProviderId;
    if (!['OpenRouter', 'OpenAI', 'Anthropic', 'Gemini', 'DeepSeek', 'Qwen', 'Kimi', 'Grok', 'Custom'].includes(provider)) return NextResponse.json({ ok: false, error: '请选择模型服务' }, { status: 400 });
    const model = (typeof body.model === 'string' ? body.model.trim() : '') || (provider === 'Custom' ? '' : AI_PROVIDER_DEFAULTS[provider].model);
    if (!model || model.length > 120) return NextResponse.json({ ok: false, error: '请填写模型名称' }, { status: 400 });
    const action = body.action === 'test' ? 'test' : 'plan';
    const adapter = body.adapter === 'openai-responses' ? 'openai-responses' : 'openai-chat';
    const rawEndpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
    const defaultBase = provider === 'Custom' ? '' : AI_PROVIDER_DEFAULTS[provider].endpoint.replace(/\/chat\/completions$/, '');
    const chatEndpoint = provider === 'Custom' ? await capabilityEndpoint(rawEndpoint, 'chat/completions') : !rawEndpoint || rawEndpoint === defaultBase ? AI_PROVIDER_DEFAULTS[provider].endpoint : provider === 'Kimi' && rawEndpoint === 'https://api.moonshot.ai/v1' ? 'https://api.moonshot.ai/v1/chat/completions' : await capabilityEndpoint(rawEndpoint, 'chat/completions');
    const endpoint = adapter === 'openai-responses' ? chatEndpoint.replace(/\/chat\/completions$/, '/responses') : chatEndpoint;
    const key = resolveCredential(body.apiKey, { provider, baseUrl: rawEndpoint || defaultBase });
    if (!key) return NextResponse.json({ ok: false, error: '请填写有效的 API Key' }, { status: 400 });
    const workflow = action !== 'test' && body.operation !== undefined ? buildSkillPlan(body) : null;
    const prompt = action === 'test' ? '只回复：连接成功' : workflow?.prompt || String(body.prompt || '');
    if (!workflow && prompt.length > 40000) return NextResponse.json({ ok: false, error: '请求内容过长' }, { status: 413 });
    const system = action === 'test' ? '你正在进行连接测试。' : workflow?.system || String(body.system || '你是楷排的中文内容编辑助手。').slice(0, 2000);
    const image = workflow && 'image' in workflow ? workflow.image : undefined;
    if (!prompt) return NextResponse.json({ ok: false, error: '文章内容为空' }, { status: 400 });
    const controller = new AbortController();
    request.signal.addEventListener('abort', () => controller.abort(), { once: true });
    if (request.signal.aborted) controller.abort();
    const timeout = setTimeout(() => controller.abort(), action === 'plan' ? 90000 : /^(gpt-[56]|claude-fable|kimi-k3)/.test(model) ? 45000 : 25000);
    let response: Response;
    let raw = {} as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }>; choices?: Array<{ message?: { content?: string } }> };
    try {
      const maxOutputTokens = action === 'test' ? 384 : 10000;
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify(adapter === 'openai-responses' ? { model, instructions: system, input: image ? [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: image }] }] : prompt, max_output_tokens: maxOutputTokens, stream: false } : { model, messages: [
          { role: provider === 'OpenAI' && /^gpt-[56]/.test(model) ? 'developer' : 'system', content: system },
          { role: 'user', content: image ? [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image, detail: 'high' } }] : prompt },
        ], ...(provider === 'Kimi' || (provider === 'OpenAI' && /^gpt-[56]/.test(model)) ? { max_completion_tokens: maxOutputTokens } : { max_tokens: maxOutputTokens }), ...(provider === 'Kimi' && model === 'kimi-k3' ? { reasoning_effort: 'low' } : {}), stream: false }),
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
      if (response.ok) raw = await response.json();
    } finally { clearTimeout(timeout); }
    if (!response.ok) {
      return NextResponse.json({ ok: false, error: `${reviewingImage ? '看图审核未完成，请确认模型支持图片输入。' : ''}${upstreamError(response.status, provider)}` }, { status: 502 });
    }
    const text = adapter === 'openai-responses' ? raw?.output_text || raw?.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content || []).map((item: { text?: string }) => item.text || '').join('') : raw?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return NextResponse.json({ ok: false, error: '服务未返回可用内容' }, { status: 502 });
    let review;
    if (reviewingImage) {
      try { review = finishCoverReview(text, body); }
      catch { return NextResponse.json({ ok: false, error: '看图模型没有返回完整审核记录；图片未获通过，可重试审核或更换看图模型' }, { status: 502 }); }
    }
    return NextResponse.json({ ok: true, text, model, review, skills: workflow?.skills || [] });
  } catch (error) {
    const failure = apiConnectionFailure(error, '文本请求');
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
