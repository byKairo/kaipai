/** Publish code versions while preserving existing domain/route triggers. */
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { verifyGitHubRelease } = require('./verify-github-release.cjs');

function uploadedVersion(output) {
  const plain = output.replace(/\u001b\[[0-9;]*m/g, '');
  const ids = [...plain.matchAll(/(?:Worker )?Version ID:\s*([a-f0-9]{8}-[a-f0-9-]{27})/gi)].map(match => match[1]);
  if (new Set(ids).size !== 1) throw new Error('无法唯一确认刚上传的 Worker 版本，未执行流量切换');
  return ids[0];
}
function publish() {
  const root = path.resolve(__dirname, '..');
  const commit = verifyGitHubRelease(root);
  const cli = path.join(root, '.cloudflare-deploy/node_modules/wrangler/bin/wrangler.js');
  const config = path.join(root, '.cloudflare-deploy/dist/server/wrangler.json');
  const upload = spawnSync(process.execPath, [cli, 'versions', 'upload', '--config', config, '--message', `GitHub ${commit}`], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  process.stdout.write(upload.stdout || '');
  process.stderr.write(upload.stderr || '');
  if (upload.status !== 0) throw new Error('Worker 版本上传失败，未切换正式流量');
  const version = uploadedVersion(upload.stdout);
  const deploy = spawnSync(process.execPath, [cli, 'versions', 'deploy', `${version}@100%`, '--config', config, '--message', `GitHub ${commit}`, '--yes'], { cwd: root, stdio: 'inherit' });
  if (deploy.status !== 0) throw new Error('Worker 流量切换未完成，请核对现有部署');
  console.log(`Published GitHub ${commit} as Worker ${version}; existing domain triggers preserved.`);
}
module.exports = { uploadedVersion };
if (require.main === module) {
  try { publish(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
