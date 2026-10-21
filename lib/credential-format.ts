/** This marker is public. The encryption keys and credential contents are server-only. */
export const CREDENTIAL_PREFIX = 'kpcred1.';
export function isSealedCredential(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith(CREDENTIAL_PREFIX);
}

export function canonicalCredentialEndpoint(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('API 地址格式不正确');
  url.pathname = url.pathname.replace(/\/(chat\/completions|images\/generations|models|responses)\/?$/, '').replace(/\/$/, '') || '/';
  return url.toString().replace(/\/$/, '');
}
