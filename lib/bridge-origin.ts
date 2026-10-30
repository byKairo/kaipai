/** Explicit opt-in; only the configured HTTPS website may call the loopback bridge. */
export function bridgeOriginAllowed(headers: Headers, enabled: boolean, allowedOrigin?: string) {
  if (!enabled || !allowedOrigin) return false;
  try {
    const allowed = new URL(allowedOrigin);
    const host = headers.get('host') || '';
    const target = new URL(`http://${host}`);
    return allowed.protocol === 'https:' && allowed.origin === allowedOrigin &&
      headers.get('origin') === allowedOrigin && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
      host === target.host;
  } catch { return false; }
}
