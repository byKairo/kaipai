import { NextRequest } from 'next/server';
import { imageAssetBindings } from '../../../lib/server/image-assets-runtime';
import { ImageAssetError, imageAssetsReady, uploadArticleImage } from '../../../lib/server/image-assets';
import { privateJson } from '../../../lib/server/request';
import { assertRequestOrigin } from '../../../lib/server/request-origin';
export async function GET() {
  const env = imageAssetBindings();
  return privateJson({ enabled: imageAssetsReady(env), siteKey: imageAssetsReady(env) ? env.siteKey : undefined });
}
export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get('origin')) return privateJson({ error: '不允许跨站提交' }, 403);
    assertRequestOrigin(request.headers, request.nextUrl.origin, process.env.KAIPAI_PUBLIC_ORIGIN);
    return privateJson(await uploadArticleImage(imageAssetBindings(), request, request.headers.get('cf-connecting-ip') || ''));
  } catch (error) {
    return privateJson({ error: error instanceof ImageAssetError ? error.message : '图片转存失败，请重试' }, error instanceof ImageAssetError ? error.status : 403);
  }
}
