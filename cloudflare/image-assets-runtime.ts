import { env } from 'cloudflare:workers';
import type { ImageAssetBindings } from '../lib/server/image-assets-runtime';
export function imageAssetBindings(): ImageAssetBindings {
  const bindings = env as unknown as Record<string, unknown>;
  return {
    bucket: bindings.ARTICLE_IMAGES as ImageAssetBindings['bucket'],
    limiter: bindings.ARTICLE_IMAGE_LIMITER as ImageAssetBindings['limiter'],
    siteKey: bindings.KAIPAI_TURNSTILE_SITE_KEY as string | undefined,
    turnstileSecret: bindings.KAIPAI_TURNSTILE_SECRET as string | undefined,
    sessionSecret: bindings.KAIPAI_ASSET_SESSION_SECRET as string | undefined,
  };
}
