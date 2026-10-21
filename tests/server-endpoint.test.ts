import assert from 'node:assert/strict';
import { capabilityEndpoint, EndpointValidationError, apiConnectionFailure, validateImageDownload, resolveEndpointAddresses } from '../lib/server-endpoint';

export async function run() {
    const dnsError = (code: string) => Object.assign(new Error('DNS query failed'), { code });
    const records = {
        records: true,
        ipv4: (async () => ['8.8.8.8']),
        ipv6: (async () => { throw dnsError('ENODATA'); }),
    };
    assert.deepEqual(await resolveEndpointAddresses('public.test', records), [{ address: '8.8.8.8', family: 4 }]);
    await assert.rejects(resolveEndpointAddresses('public.test', {
        ...records, ipv6: (async () => { throw dnsError('ETIMEOUT'); }),
    }), { code: 'ETIMEOUT' });
    const mixedResolver = (hostname: string) => resolveEndpointAddresses(hostname, {
        ...records, ipv6: (async () => ['::1']),
    });
    await assert.rejects(capabilityEndpoint('https://public.test/v1', 'models', { resolve: mixedResolver }), EndpointValidationError);
    await assert.rejects(validateImageDownload('https://public.test/image.png', { resolve: mixedResolver }), EndpointValidationError);
    const publicResolver = async () => [{ address: '8.8.8.8', family: 4 }];
    assert.equal((await validateImageDownload('https://images.test/file.png?signature=test', { resolve: publicResolver })).hostname, 'images.test');
    for (const source of ['http://images.test/image.png', 'https://127.0.0.1/image.png', 'file:///etc/passwd']) await assert.rejects(validateImageDownload(source, { resolve: publicResolver }), EndpointValidationError);
    await assert.rejects(validateImageDownload('https://images.test/file', { resolve: async () => [{ address: '10.0.0.1', family: 4 }] }), EndpointValidationError);
    const paths = ['models', 'chat/completions', 'images/generations'] as const;
    for (const path of paths) {
        assert.equal(await capabilityEndpoint('http://127.0.0.1:8045/v1', path, { allowLoopback: true }), `http://127.0.0.1:8045/v1/${path}`);
        assert.equal(await capabilityEndpoint('http://localhost:8045/v1/chat/completions', path, { allowLoopback: true }), `http://localhost:8045/v1/${path}`);
        assert.equal(await capabilityEndpoint('http://[::1]:8045/v1/', path, { allowLoopback: true }), `http://[::1]:8045/v1/${path}`);
        await assert.rejects(capabilityEndpoint('http://127.0.0.1:8045/v1', path, { allowLoopback: false }), EndpointValidationError);
    }
    for (const source of ['http://192.168.1.1/v1', 'http://10.0.0.1:80/v1', 'http://169.254.169.254/v1', 'http://0.0.0.0:8045/v1', 'http://[::]/v1', 'ftp://localhost/v1', 'http://user:pass@localhost/v1', 'http://localhost/v1?key=private', 'http://localhost/v1#private', 'http://localhost/wrong']) {
        await assert.rejects(capabilityEndpoint(source, 'models', { allowLoopback: true }), EndpointValidationError, source);
    }
    for (const source of ['/v1', 'not a url']) await assert.rejects(capabilityEndpoint(source, 'models'), EndpointValidationError);
    for (const address of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '169.254.169.254', '::1', '::', 'fd00::1', '::ffff:127.0.0.1']) {
        await assert.rejects(capabilityEndpoint('https://public.test/v1', 'models', { allowLoopback: true, resolve: async () => [{ address, family: address.includes(':') ? 6 : 4 }] }), EndpointValidationError);
    }
    for (const suffix of ['', '/chat/completions', '/models', '/images/generations', '/responses']) {
        assert.equal(await capabilityEndpoint(`https://public.test/api/v1${suffix}`, 'models', { allowLoopback: false, resolve: publicResolver }), 'https://public.test/api/v1/models');
    }
    const invalid = new EndpointValidationError('本机 API 未启用');
    for (const operation of ['文本请求', '配图请求', '模型列表']) assert.deepEqual(apiConnectionFailure(invalid, operation), { status: 400, error: '本机 API 未启用' });
    assert.match(apiConnectionFailure(Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }), '配图请求').error, /代理已启动/);
    assert.match(apiConnectionFailure(Object.assign(new Error('lookup failed'), { code: 'ENOTFOUND' }), '模型列表').error, /无法解析/);
    assert.equal(apiConnectionFailure(Object.assign(new Error(), { name: 'AbortError' }), '文本请求').status, 504);
    assert.ok(!apiConnectionFailure(new Error('private-key-in-error'), '配图请求').error.includes('private-key'));
    console.log('PASS: local production endpoints, consistent validation, public deployment restrictions and safe connection errors');
}
