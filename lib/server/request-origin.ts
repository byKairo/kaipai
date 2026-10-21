import { CredentialError } from './credential-codec';

/** Next may normalize a loopback nextUrl hostname to localhost. Host reflects the browser's actual target. */
export function assertRequestOrigin(headers: Headers, nextOrigin: string, publicOrigin?: string) {
  if (headers.get('sec-fetch-site') === 'cross-site') throw new CredentialError('不允许跨站提交', 403);
  const origin = headers.get('origin');
  if (!origin) return;
  try {
    const target = new URL(nextOrigin);
    const host = headers.get('host');
    if (host) {
      const actual = new URL(`${target.protocol}//${host}`);
      if (actual.host.toLowerCase() !== host.toLowerCase() || actual.username || actual.password || actual.pathname !== '/' || actual.search || actual.hash) throw new Error();
      target.host = actual.host;
    }
    const expected = publicOrigin ? new URL(publicOrigin).origin : target.origin;
    const source = new URL(origin);
    if (source.origin !== expected || source.username || source.password || source.pathname !== '/' || source.search || source.hash) throw new Error();
  } catch { throw new CredentialError('不允许跨站提交', 403); }
}
