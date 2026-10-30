import { imageAssetBindings } from '../../../../lib/server/image-assets-runtime';
export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const params = await context.params;
  if (!/^[a-f0-9]{64}\.(png|jpg)$/.test(params.key)) return new Response(null, { status: 404 });
  const bucket = imageAssetBindings().bucket;
  if (!bucket) return new Response(null, { status: 503 });
  const object = await bucket.get(params.key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, { headers: {
    'Content-Type': params.key.endsWith('.png') ? 'image/png' : 'image/jpeg', 'Content-Length': String(object.size),
    'Cache-Control': 'public, max-age=31536000, immutable', 'ETag': object.httpEtag,
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Referrer-Policy': 'no-referrer',
  } });
}
