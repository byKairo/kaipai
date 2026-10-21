import { NextRequest } from 'next/server';
import { platform } from '../../../../lib/server/platform';
import { privateJson } from '../../../../lib/server/request';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const session = await platform.auth?.session(request);
  return privateJson({ mode: session ? 'account' : 'guest', account: session ? { displayName: session.displayName } : null, loginAvailable: Boolean(platform.auth) });
}
