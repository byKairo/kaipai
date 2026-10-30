import { readResponseJson, RESPONSE_LIMITS } from '../../../../lib/response-body';
import { apiConnectionFailure } from '../../../../lib/server-endpoint';
import { NextRequest } from 'next/server';
import { resolveCredential } from '../../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
const NextResponse = { json: (body: unknown, init?: { status?: number }) => privateJson(body, init?.status) };

export const runtime = 'nodejs';

type CatalogModel = { id: string; name: string; description: string; context: number; free: boolean };

export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 240000);
    const query = typeof body?.query === 'string' ? body.query.trim().slice(0, 80) : '';
    const key = body.apiKey ? resolveCredential(body.apiKey, { provider: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' }) : '';
    if (key.length > 4096) return NextResponse.json({ ok: false, error: '密钥过长' }, { status: 400 });
    const url = new URL('https://openrouter.ai/api/v1/models');
    url.searchParams.set('output_modalities', 'text');
    if (query) url.searchParams.set('q', query);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch(url, { headers: key ? { Authorization: `Bearer ${key}` } : {}, signal: controller.signal, cache: 'no-store', redirect: 'manual' });
      if (!response.ok) return NextResponse.json({ ok: false, error: `模型库暂时不可用（${response.status}）` }, { status: 502 });
      const payload = await readResponseJson(response, RESPONSE_LIMITS.models);
      const models: CatalogModel[] = (Array.isArray(payload?.data) ? payload.data : []).slice(0, 30).filter((item: unknown) => Boolean(item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string')).map((item: { id: string; name?: string; description?: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }) => ({
        id: item.id,
        name: typeof item.name === 'string' ? item.name : item.id,
        description: typeof item.description === 'string' ? item.description.slice(0, 220) : '',
        context: Number(item.context_length) || 0,
        free: Number(item.pricing?.prompt) === 0 && Number(item.pricing?.completion) === 0,
      }));
      return NextResponse.json({ ok: true, models });
    } finally { clearTimeout(timeout); }
  } catch (error) {
    const failure = apiConnectionFailure(error, '读取模型列表');
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
