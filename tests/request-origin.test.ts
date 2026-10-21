import assert from 'node:assert/strict';
import { assertRequestOrigin } from '../lib/server/request-origin';
import { CredentialError } from '../lib/server/credential-codec';

export function run() {
  for (const host of ['127.0.0.1:3003', 'localhost:3003', '[::1]:3003']) {
    const headers = new Headers({ host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' });
    assert.doesNotThrow(() => assertRequestOrigin(headers, 'http://localhost:3003'));
    for (const origin of ['http://attacker.test', 'http://localhost:9999', 'null', 'http://localhost:3003/path']) {
      headers.set('origin', origin);
      assert.throws(() => assertRequestOrigin(headers, 'http://localhost:3003'), CredentialError);
    }
  }
  const proxied = new Headers({ host: 'internal:3003', origin: 'https://kaipai.test', 'sec-fetch-site': 'same-origin' });
  assert.doesNotThrow(() => assertRequestOrigin(proxied, 'http://internal:3003', 'https://kaipai.test'));
  proxied.set('origin', 'http://internal:3003');
  assert.throws(() => assertRequestOrigin(proxied, 'http://internal:3003', 'https://kaipai.test'), CredentialError);
  proxied.set('origin', 'https://kaipai.test');
  proxied.set('sec-fetch-site', 'cross-site');
  assert.throws(() => assertRequestOrigin(proxied, 'http://internal:3003', 'https://kaipai.test'), CredentialError);
  assert.doesNotThrow(() => assertRequestOrigin(new Headers(), 'http://localhost:3003'));
  assert.throws(() => assertRequestOrigin(new Headers({ host: 'localhost:3003/evil', origin: 'http://localhost:3003' }), 'http://localhost:3003'), CredentialError);
  console.log('PASS: actual loopback Host, strict cross-site rejection and explicit reverse-proxy origin');
}
