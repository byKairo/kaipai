import { NextRequest } from 'next/server';
import { platform } from '../../../../lib/server/platform';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
import { apiConnectionFailure } from '../../../../lib/server-endpoint';
export async function POST(request: NextRequest) {
  try {
    await readPrivateRequest(request, 240000);
    const actor = await platform.auth?.session(request);
    if (!actor) return privateJson({ ok: false, error: '公众号同步需要账号登录；当前版本尚未开放登录' }, 401);
    // Deliberately closed until real authorization, asset upload and idempotency are validated.
    return privateJson({ ok: false, error: '公众号草稿同步尚未接通，请使用复制和图片包导出' }, 501);
  } catch (error) {
    const failure = apiConnectionFailure(error, '公众号同步');
    return privateJson({ ok: false, error: failure.error }, failure.status);
  }
}
