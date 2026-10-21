import { NextRequest } from 'next/server';
import { AI_PROVIDER_DEFAULTS, type AiProviderId } from '../../../../lib/providers';
import { canonicalCredentialEndpoint } from '../../../../lib/credential-format';
import { CredentialError, resolveCredential, sealCredential } from '../../../../lib/server/credentials';
import { readPrivateRequest, privateJson } from '../../../../lib/server/request';
import { capabilityEndpoint, apiConnectionFailure } from '../../../../lib/server-endpoint';

export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  try {
    const body = await readPrivateRequest(request);
    const provider = body.provider as AiProviderId;
    if (!(provider === 'Custom' || Object.hasOwn(AI_PROVIDER_DEFAULTS, provider))) throw new CredentialError('请选择模型服务');
    let baseUrl: string;
    try {
      const rawBase = String(body.baseUrl || (provider === 'Custom' ? '' : AI_PROVIDER_DEFAULTS[provider].endpoint));
      if (rawBase.length > 2048) throw new Error();
      baseUrl = canonicalCredentialEndpoint(rawBase);
    } catch { throw new CredentialError('请填写有效的 API 基础地址'); }
    const official = provider !== 'Custom' && (baseUrl === canonicalCredentialEndpoint(AI_PROVIDER_DEFAULTS[provider].endpoint) || provider === 'Kimi' && baseUrl === 'https://api.moonshot.ai/v1');
    if (!official) await capabilityEndpoint(baseUrl, 'models');
    const binding = { provider, baseUrl, workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId : '' };
    if (binding.workspaceId.length > 80) throw new CredentialError('业务空间 ID 过长');
    const rawKey = resolveCredential(body.apiKey, binding);
    return privateJson({ ok: true, credential: sealCredential(rawKey, binding) });
  } catch (error) {
    if (error instanceof CredentialError) return privateJson({ ok: false, error: error.message }, error.status);
    const failure = apiConnectionFailure(error, '保存连接');
    return privateJson({ ok: false, error: failure.error }, failure.status);
  }
}
