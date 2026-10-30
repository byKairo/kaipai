import 'server-only';
import { bridgeOriginAllowed } from '../bridge-origin';
import { NextRequest, NextResponse } from 'next/server';
import { CredentialError } from './credentials';
import { assertRequestOrigin } from './request-origin';

export function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, private', 'Pragma': 'no-cache' } });
}

export async function readPrivateRequest(request: NextRequest, maxBytes = 24000): Promise<Record<string, unknown>> {
  if (!bridgeOriginAllowed(request.headers, process.env.KAIPAI_LOCAL_BRIDGE === '1', process.env.KAIPAI_BRIDGE_ORIGIN)) assertRequestOrigin(request.headers, request.nextUrl.origin, process.env.KAIPAI_PUBLIC_ORIGIN);
  if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new CredentialError('请使用 JSON 请求', 415);
  if (Number(request.headers.get('content-length') || 0) > maxBytes) throw new CredentialError('请求内容过长', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new CredentialError('请求为空');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new CredentialError('请求内容过长', 413); }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch { throw new CredentialError('请求格式不正确'); }
}
