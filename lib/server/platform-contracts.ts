/** Every account repository operation receives identity from the server auth adapter. */
export type AccountSession = { userId: string; displayName: string };
export interface AuthAdapter {
  session(request: Request): Promise<AccountSession | null>;
}
export type AccountCredential = { id: string; ownerId: string; provider: string; baseUrl: string; credential: string };
export interface AccountCredentialRepository {
  find(ownerId: string, id: string): Promise<AccountCredential | null>;
  save(ownerId: string, record: AccountCredential): Promise<void>;
  remove(ownerId: string, id: string): Promise<void>;
}
export interface WechatDraftAdapter {
  /** Implement server-managed authorization, image upload, and idempotent draft creation here. */
  syncDraft(input: { ownerId: string; articleId: string; revision: string; title: string; html: string }): Promise<{ mediaId: string }>;
}
export async function ownedCredential(repository: AccountCredentialRepository, actor: AccountSession, id: string) {
  const record = await repository.find(actor.userId, id);
  if (!record || record.ownerId !== actor.userId) return null;
  return record;
}
