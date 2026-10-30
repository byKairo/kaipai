export interface ImageAssetBucket {
  head(key: string): Promise<unknown | null>;
  put(key: string, value: Uint8Array, options: { httpMetadata: { contentType: string } }): Promise<unknown>;
  get(key: string): Promise<{ body: ReadableStream; size: number; httpEtag: string } | null>;
}
export type ImageAssetBindings = {
  bucket?: ImageAssetBucket;
  limiter?: { limit(input: { key: string }): Promise<{ success: boolean }> };
  siteKey?: string;
  turnstileSecret?: string;
  sessionSecret?: string;
};
// Workers preparation replaces this adapter with the native binding adapter.
// Ordinary Next deployments fail closed instead of accepting unprotected uploads.
export function imageAssetBindings(): ImageAssetBindings { return {}; }
