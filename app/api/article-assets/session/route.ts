import { NextRequest } from 'next/server';
import { imageAssetBindings } from '../../../../lib/server/image-assets-runtime';
import { ImageAssetError, createImageUploadSession } from '../../../../lib/server/image-assets';
import { privateJson, readPrivateRequest } from '../../../../lib/server/request';
export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get('origin')) return privateJson({ error: '不允许跨站提交' }, 403);
    const body = await readPrivateRequest(request, 4096);
    const cookie = await createImageUploadSession(imageAssetBindings(), typeof body.token === 'string' ? body.token : '', request.nextUrl.hostname, request.headers.get('cf-connecting-ip') || '');
    const response = privateJson({ ok: true }); response.headers.set('Set-Cookie', cookie); return response;
  } catch (error) {
    return privateJson({ error: error instanceof ImageAssetError ? error.message : '图片上传验证失败，请重试' }, error instanceof ImageAssetError ? error.status : 403);
  }
}
