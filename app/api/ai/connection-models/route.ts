import { readResponseJson, RESPONSE_LIMITS } from '../../../../lib/response-body';
import { NextRequest } from 'next/server';
import { resolveCredential } from '../../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
const NextResponse = { json: (body: unknown, init?: { status?: number }) => privateJson(body, init?.status) };
import { capabilityEndpoint, apiConnectionFailure } from '../../../../lib/server-endpoint';

import { parseModelDirectory, type DiscoveryModel } from '../../../../lib/model-discovery';

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
      const models = new Map<string, DiscoveryModel>();
      let next = endpoint;
      const cursors = new Set<string>();
      const budget = { remaining: RESPONSE_LIMITS.modelPages };
      for (let page = 0; page < 30; page++) {
        const response = await fetch(next, { headers: geminiOfficial ? { 'x-goog-api-key': apiKey } : anthropicOfficial ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${apiKey}` }, signal: controller.signal, redirect: 'manual', cache: 'no-store' });
        if (!response.ok) return NextResponse.json({ ok: false, error: `当前连接的模型列表返回 ${response.status}` }, { status: 502 });
        const payload = await readResponseJson(response, RESPONSE_LIMITS.models, budget);
        for (const model of parseModelDirectory(payload)) models.set(model.id, model);
        const cursor = geminiOfficial ? payload.nextPageToken : anthropicOfficial && payload.has_more ? payload.last_id : '';
        if (!cursor) return NextResponse.json({ ok: true, models: Array.from(models.values()), fetchedAt: new Date().toISOString(), source: 'connection' });
        if (typeof cursor !== 'string' || cursors.has(cursor)) throw new Error('模型目录分页异常');
        cursors.add(cursor);
        const url = new URL(endpoint);
        url.searchParams.set(geminiOfficial ? 'pageToken' : 'after_id', cursor);
        next = url.toString();
      }
      return NextResponse.json({ ok: false, error: '模型目录分页过多，请缩小服务端目录范围后重试' }, { status: 502 });
    } finally { clearTimeout(timer); }
  } catch (error) {
    const failure = apiConnectionFailure(error, '读取当前连接模型列表');
    return NextResponse.json({ ok: false, error: failure.error }, { status: failure.status });
  }
}
