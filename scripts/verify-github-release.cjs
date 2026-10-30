/** Production has one owner: the main-branch GitHub Actions deployment. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function verifyGitHubRelease(root = path.resolve(__dirname, '..'), env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== 'byKairo/kaipai' || env.GITHUB_REF !== 'refs/heads/main' || !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA || '')) {
    throw new Error('正式站点仅通过 GitHub main 的部署流程发布。请先提交并推送，再查看 GitHub Actions；本机可以构建和预览。');
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  if (head !== env.GITHUB_SHA) throw new Error('部署提交与 GitHub Actions 提交不一致');
  const prepared = JSON.parse(fs.readFileSync(path.join(root, '.cloudflare-deploy/prepared-source.json'), 'utf8'));
  if (prepared.commit !== head) throw new Error('构建产物未绑定当前 GitHub 提交，请重新构建');
  console.log('GitHub production source verified: ' + head);
  return head;
}
module.exports = { verifyGitHubRelease };
if (require.main === module) {
  try { verifyGitHubRelease(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
