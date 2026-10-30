import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const { verifyGitHubRelease } = require('../scripts/verify-github-release.cjs');
const { artifactDigest } = require('../scripts/verify-cloudflare-build.cjs');

export function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kaipai-release-gate-'));
  const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    git(['init', '-q']);
    git(['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture', '--allow-empty']);
    const sha = git(['rev-parse', 'HEAD']);
    const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'byKairo/kaipai', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha };
    fs.mkdirSync(path.join(root, '.cloudflare-deploy'));
    fs.writeFileSync(path.join(root, '.cloudflare-deploy/prepared-source.json'), JSON.stringify({ commit: sha }));
    assert.throws(() => verifyGitHubRelease(root, {}), /仅通过 GitHub/);
    assert.throws(() => verifyGitHubRelease(root, { ...env, GITHUB_REF: 'refs/heads/feature' }), /仅通过 GitHub/);
    assert.throws(() => verifyGitHubRelease(root, { ...env, GITHUB_REPOSITORY: 'other/repo' }), /仅通过 GitHub/);
    assert.throws(() => verifyGitHubRelease(root, { ...env, GITHUB_SHA: '0'.repeat(40) }), /提交不一致/);
    assert.equal(verifyGitHubRelease(root, env), sha);
    fs.writeFileSync(path.join(root, '.cloudflare-deploy/prepared-source.json'), JSON.stringify({ commit: '0'.repeat(40) }));
    assert.throws(() => verifyGitHubRelease(root, env), /未绑定当前 GitHub/);
    const dist = path.join(root, 'dist');
    fs.mkdirSync(dist);
    fs.writeFileSync(path.join(dist, 'worker.js'), 'export default {};');
    const originalDigest = artifactDigest(dist);
    fs.mkdirSync(path.join(dist, '.wrangler/state'), { recursive: true });
    fs.writeFileSync(path.join(dist, '.wrangler/state/preview.sqlite'), 'preview-only state');
    assert.equal(artifactDigest(dist), originalDigest, 'runtime validation state is not a deployed build artifact');
    fs.writeFileSync(path.join(dist, 'worker.js'), 'export default { changed: true };');
    assert.notEqual(artifactDigest(dist), originalDigest, 'actual code changes must still invalidate the build');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  console.log('PASS: local/fork/feature publication refusal, matching GitHub head and immutable build commit');
}
