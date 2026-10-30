import { readResponseText, RESPONSE_LIMITS } from '../../../../lib/response-body';
import { NextRequest } from 'next/server';
import { privateJson, readPrivateRequest } from '../../../../lib/server/request';
import { REFERENCE_SOURCES, IMAGE_REFERENCE_SOURCES, extractReferenceModels, referenceModels, type ReferenceProvider } from '../../../../lib/reference-models';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request, 2000);
    const provider = body.provider as ReferenceProvider;
    if (!Object.hasOwn(REFERENCE_SOURCES, provider)) return privateJson({ ok: false, error: '请选择目录厂商' }, 400);
    const source = REFERENCE_SOURCES[provider];
    try {
      // Fixed official URL only. Never forward a user credential to a reference source.
      const sources = [source.url, IMAGE_REFERENCE_SOURCES[provider]].filter((url): url is string => Boolean(url));
      const results = await Promise.allSettled(sources.map(async url => {
        const response = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: 'manual', cache: 'no-store' });
        if (!response.ok) throw new Error();
        const html = await readResponseText(response, RESPONSE_LIMITS.reference);
        if (html.length > 5000000) throw new Error();
        return extractReferenceModels(html, provider);
      }));
      const models = Array.from(new Map(results.flatMap(result => result.status === 'fulfilled' ? result.value : []).map(model => [model.id, model])).values());
      if (!models.length) throw new Error();
      return privateJson({ ok: true, models, source: source.url, sources, partial: results.some(result => result.status === 'rejected'), status: 'live', fetchedAt: new Date().toISOString() });
    } catch {
      return privateJson({ ok: true, models: referenceModels(source.snapshot), source: source.url, status: 'snapshot', fetchedAt: '2026-10-22', warning: '官方目录暂时无法更新，显示已核对的参考快照；不代表当前接口支持。' });
    }
  } catch { return privateJson({ ok: false, error: '目录请求无效' }, 400); }
}
