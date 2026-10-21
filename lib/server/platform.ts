import 'server-only';
import type { AuthAdapter, AccountCredentialRepository, WechatDraftAdapter } from './platform-contracts';

// Replace with verified adapters after choosing login provider, database and WeChat authorization.
// No request parameter or browser-supplied user ID can create an authenticated identity.
export const platform: {
  auth: AuthAdapter | null;
  accountCredentials: AccountCredentialRepository | null;
  wechat: WechatDraftAdapter | null;
} = { auth: null, accountCredentials: null, wechat: null };
