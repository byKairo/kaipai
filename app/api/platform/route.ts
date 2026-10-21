import { credentialsConfigured } from '../../../lib/server/credentials';
import { privateJson } from '../../../lib/server/request';
import { skillVersions } from '../../../lib/server/skills';
import { platform } from '../../../lib/server/platform';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export function GET() {
  const github = process.env.KAIPAI_GITHUB_URL || '';
  const githubUrl = /^https:\/\/github\.com\/[a-zA-Z0-9_.\/-]+$/.test(github) ? github : null;
  return privateJson({ guest: { persistentCredentials: credentialsConfigured() }, login: Boolean(platform.auth), wechat: Boolean(platform.auth && platform.wechat), skills: skillVersions(), githubUrl });
}
