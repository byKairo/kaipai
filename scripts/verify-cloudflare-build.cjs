/** Refuse stale deployment artifacts and Workers-incompatible redirect handling. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = path.join(root, '.cloudflare-deploy');
const stamp = path.join(target, 'verified-build.json');
function files(directory, ignoreRuntime = false) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (ignoreRuntime && entry.name === '.wrangler') return [];
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file, ignoreRuntime) : [file];
  }).sort();
}
function digest(list) {
  const hash = crypto.createHash('sha256');
  for (const file of list) hash.update(path.relative(root, file)).update('\0').update(fs.readFileSync(file)).update('\0');
  return hash.digest('hex');
}
function sourceDigest() {
  return digest(['app', 'lib', 'server', 'public', 'cloudflare'].flatMap(name => files(path.join(root, name))).concat([
    ...['next.config.mjs', 'tsconfig.json', 'package.json', 'package-lock.json'].map(name => path.join(root, name)),
    path.join(root, 'scripts/prepare-cloudflare.cjs'), path.join(root, 'scripts/finalize-cloudflare.cjs'), __filename,
    path.join(root, 'scripts/release-assets.cjs'), path.join(root, 'scripts/verify-github-release.cjs'), path.join(root, 'scripts/deployment-safety.cjs'),
  ]).sort());
}
function createReleaseId(source) {
  // Framework BUILD_ID/chunk identities can change even for identical source.
  // Every prepared build gets a fresh edge-cache namespace; source is still
  // recorded independently for stale-artifact verification.
  return `${source}-${crypto.randomUUID()}`;
}
function artifactDigest(directory = path.join(target, 'dist')) { return digest(files(directory, true)); }
function verify() {
  const source = sourceDigest();
  const prepared = JSON.parse(fs.readFileSync(path.join(target, 'prepared-source.json'), 'utf8'));
  if (prepared.source !== source) throw new Error('源码在准备部署后已变化，请重新运行 npm run cf:build');
  const artifacts = files(path.join(target, 'dist'), true);
  for (const file of artifacts.filter(file => file.endsWith('.js'))) {
    if (/redirect\s*:\s*(['"`])error\1/.test(fs.readFileSync(file, 'utf8'))) {
      throw new Error(`Workers 构建含不支持的 redirect:error：${path.relative(target, file)}`);
    }
  }
  const current = { source, artifacts: digest(artifacts) };
  if (process.argv.includes('--record')) fs.writeFileSync(stamp, JSON.stringify(current));
  else {
    const recorded = JSON.parse(fs.readFileSync(stamp, 'utf8'));
    if (recorded.source !== source || recorded.artifacts !== current.artifacts) throw new Error('部署产物未验证或已变化，请重新运行 npm run cf:build');
  }
  console.log('Cloudflare build verified: current source, unchanged artifacts, supported redirects.');
}
module.exports = { sourceDigest, createReleaseId, artifactDigest };
if (require.main === module) verify();
