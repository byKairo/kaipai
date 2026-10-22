import { NextRequest } from 'next/server';
import { resolveCredential } from '../../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
const NextResponse = { json: (body: unknown, init?: { status?: number }) => privateJson(body, init?.status) };
import { capabilityEndpoint, apiConnectionFailure } from '../../../../lib/server-endpoint';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 240000);
    const baseUrl = typeof body?.baseUrl === 'string' ? body.baseUrl.trim() : '';
    const apiKey = resolveCredential(body.apiKey, { baseUrl });
    if (!baseUrl || !apiKey || apiKey.length > 4096) return NextResponse.json({ ok: false, error: '请填写 API 地址和 Key' }, { status: 400 });
    const geminiOfficial = baseUrl === 'https://generativelanguage.googleapis.com/v1beta/openai';
    const anthropicOfficial = baseUrl === 'https://api.anthropic.com/v1';
    const endpoint = geminiOfficial ? 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200' : anthropicOfficial ? 'https://api.anthropic.com/v1/models?limit=100' : await capabilityEndpoint(baseUrl, 'models');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(endpoint, { headers: geminiOfficial ? { 'x-goog-api-key': apiKey } : anthropicOfficial ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${apiKey}` }, signal: controller.signal, redirect: 'manual', cache: 'no-store' });
      if (!response.ok) return NextResponse.json({ ok: false, error: `当前连接的模型列表返回 ${response.status}` }, { status: 502 });
      const payload = await response.json();
      const data = geminiOfficial ? payload?.models : payload?.data;
      const models = (Array.isArray(data) ? data : []).filter((item: unknown): item is { id?: string; name?: string } => Boolean(item && typeof item === 'object')).map((item: { id?: string; name?: string }) => geminiOfficial ? (item.name || '').replace(/^models\//, '') : item.id || '').filter(Boolean).slice(0, 500).map((id: string) => ({ id: id.slice(0, 120), name: id.slice(0, 120) }));
      return NextResponse.json({ ok: true, models });
    } finally { clearTimeout(timer); }
  } catch (error) {
    const failure = apiConnectionFailure(error, '读取当前连接模型列表');
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
