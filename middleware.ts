import { NextRequest, NextResponse } from 'next/server';
import { bridgeOriginAllowed } from './lib/bridge-origin';
export function middleware(request: NextRequest) {
  if (process.env.KAIPAI_LOCAL_BRIDGE !== '1') return NextResponse.next();
  if (!bridgeOriginAllowed(request.headers, true, process.env.KAIPAI_BRIDGE_ORIGIN)) {
    // Same-origin use still goes through the route's normal origin checks.
    if (request.method === 'OPTIONS') return new NextResponse(null, { status: 403 });
    return NextResponse.next();
  }
  const response = request.method === 'OPTIONS' ? new NextResponse(null, { status: 204 }) : NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', process.env.KAIPAI_BRIDGE_ORIGIN!);
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Allow-Private-Network', 'true');
  response.headers.set('Vary', 'Origin');
  return response;
}
export const config = { matcher: ['/api/ai/:path*', '/api/credentials/seal'] };
