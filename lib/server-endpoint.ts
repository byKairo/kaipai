import { UpstreamResponseLimitError } from './response-body';
import { CredentialError } from './server/credential-codec';
import { lookup, resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';

export class EndpointValidationError extends Error {}

/** Workers supports record queries, but not dns.lookup. Keep Node's resolver by default. */
export async function resolveEndpointAddresses(hostname: string, options: {
  records?: boolean;
  ipv4?: (hostname: string) => Promise<string[]>;
  ipv6?: (hostname: string) => Promise<string[]>;
} = {}) {
  if (!(options.records ?? process.env.KAIPAI_DNS_RESOLVER === 'records')) return lookup(hostname, { all: true });
  const results = await Promise.allSettled([
    (options.ipv4 ?? resolve4)(hostname),
    (options.ipv6 ?? resolve6)(hostname),
  ]);
  const addresses: Array<{ address: string; family: number }> = [];
  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    if (result.status === 'fulfilled') {
      addresses.push(...result.value.map(address => ({ address, family: index === 0 ? 4 : 6 })));
    } else {
      // A domain may publish only one family. Other failures must not bypass validation.
      const code = (result.reason as { code?: string })?.code;
      if (code !== 'ENODATA' && code !== 'ENOTFOUND') throw result.reason;
    }
  }
  if (!addresses.length) throw Object.assign(new Error('No DNS addresses'), { code: 'ENOTFOUND' });
  return addresses;
}

function publicAddress(address: string) {
  if (address.includes(':')) {
    const value = address.toLowerCase();
    return /^[23]/.test(value) && !value.startsWith('2001:db8:') && !value.startsWith('2002:');
  }
  const [a, b] = address.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
}

/** Provider-returned image URLs are untrusted too; never follow redirects into internal services. */
export async function validateImageDownload(raw: string, options: EndpointOptions = {}) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new EndpointValidationError('图片地址格式不正确'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new EndpointValidationError('模型返回的图片必须使用公网 HTTPS 域名');
  const addresses = await (options.resolve ?? resolveEndpointAddresses)(url.hostname);
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new EndpointValidationError('图片地址不能指向本机或内网');
  return url;
}

type EndpointOptions = {
  allowLoopback?: boolean;
  resolve?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
};

export async function capabilityEndpoint(raw: string, path: 'chat/completions' | 'images/generations' | 'models', options: EndpointOptions = {}) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new EndpointValidationError('API 地址格式不正确，请填写完整的 HTTP 或 HTTPS 地址'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const allowLoopback = options.allowLoopback ?? (process.env.NODE_ENV === 'development' || process.env.KAIPAI_ALLOW_LOOPBACK_API === '1');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new EndpointValidationError('API 地址只能使用 HTTP 或 HTTPS，不能包含账号密码、查询参数或片段');
  if (loopback && !allowLoopback) throw new EndpointValidationError('当前服务未启用本机 API；本地运行请使用 npm run start:local，公网部署请填写公网接口域名');
  if (!(loopback && allowLoopback)) {
    if (url.protocol !== 'https:') throw new EndpointValidationError('公网 API 地址必须使用 HTTPS');
    if (url.port || isIP(url.hostname.replace(/^\[|\]$/g, '')) || url.hostname.endsWith('.local')) throw new EndpointValidationError('自定义接口需使用公网 HTTP 或 HTTPS 域名；本机代理请使用本地运行模式');
    const resolve = options.resolve ?? resolveEndpointAddresses;
    const addresses = await resolve(url.hostname);
    if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new EndpointValidationError('接口域名不能指向本机或内网');
  }
  const base = url.pathname.replace(/\/(chat\/completions|images\/generations|models|responses)\/?$/, '').replace(/\/$/, '');
  if (base && !base.endsWith('/v1')) throw new EndpointValidationError('API 地址需指向服务的 /v1 基础地址');
  url.pathname = `${base}/${path}`;
  return url.toString();
}

/** Validation errors must be identical across model discovery, text and images; never expose credentials. */
export function apiConnectionFailure(error: unknown, operation: string) {
  if (error instanceof UpstreamResponseLimitError) return { status: 502, error: error.message };
  if (error instanceof CredentialError) return { status: error.status, error: error.message };
  if (error instanceof EndpointValidationError) return { status: 400, error: error.message };
  if (error instanceof Error && error.name === 'AbortError') return { status: 504, error: `${operation}超时，请稍后重试` };
  const cause = error instanceof Error ? (error as Error & { code?: string; cause?: { code?: string } }) : undefined;
  const code = cause?.cause?.code || cause?.code;
  if (code === 'ECONNREFUSED') return { status: 502, error: `${operation}无法连接 API 服务，请确认代理已启动、端口正确` };
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return { status: 502, error: `${operation}无法解析 API 域名，请检查地址和网络` };
  return { status: 502, error: `${operation}失败，请检查 API 服务、网络和请求格式` };
}
