// Build an isolated deployment workspace; never copy local secrets or user output.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { assertSafeDeploymentInputs } = require('./deployment-safety.cjs');
const root = path.resolve(__dirname, '..');
assertSafeDeploymentInputs(root);
const target = path.join(root, '.cloudflare-deploy');
fs.mkdirSync(target, { recursive: true });
fs.rmSync(path.join(target, 'verified-build.json'), { force: true });
const { sourceDigest, createReleaseId } = require('./verify-cloudflare-build.cjs');
const preparedSource = sourceDigest();
const commit = /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || '') ? process.env.GITHUB_SHA : null;
for (const name of ['app', 'lib', 'server', 'public']) {
  fs.rmSync(path.join(target, name), { recursive: true, force: true });
  fs.cpSync(path.join(root, name), path.join(target, name), { recursive: true });
}
for (const name of ['next.config.mjs', 'next-env.d.ts', 'tsconfig.json']) fs.copyFileSync(path.join(root, name), path.join(target, name));
for (const name of ['package.json', 'vite.config.ts', 'wrangler.jsonc', 'worker.ts', 'public-shell-cache.ts', 'editor-preload.ts']) fs.copyFileSync(path.join(root, 'cloudflare', name), path.join(target, name));
// A fresh preparation may get a different framework BUILD_ID for identical
// source, so include a per-build nonce as well as the validated source digest.
fs.writeFileSync(path.join(target, 'public-shell-release.ts'), `export const release = ${JSON.stringify(createReleaseId(preparedSource))};\nexport const sourceCommit = ${JSON.stringify(commit)};\n`);
if (fs.existsSync(path.join(root, 'cloudflare/package-lock.json'))) fs.copyFileSync(path.join(root, 'cloudflare/package-lock.json'), path.join(target, 'package-lock.json'));
const manifest = JSON.parse(fs.readFileSync(path.join(target, 'server/skills/manifest.json'), 'utf8'));
const resources = {};
for (const [skill, metadata] of Object.entries(manifest.skills)) {
  for (const [file, hash] of Object.entries(metadata.files)) {
    const bytes = fs.readFileSync(path.join(target, 'server/skills', skill, file));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error(`Skill hash mismatch: ${skill}/${file}`);
    resources[`${skill}/${file}`] = bytes.toString('utf8');
  }
}
fs.writeFileSync(path.join(target, 'server/skills/resources.json'), JSON.stringify(resources));
const workflow = path.join(target, 'lib/server/skill-workflows.ts');
let source = fs.readFileSync(workflow, 'utf8');
const original = "readFileSync(join(root, key), 'utf8')";
if (!source.includes(original)) throw new Error('Skill loader changed; review the Cloudflare bundle transform');
source = source.replace("import { readFileSync } from 'node:fs';", "import bundledResources from '../../server/skills/resources.json';")
  .replace("import { join } from 'node:path';\n", '')
  .replace("const root = join(process.cwd(), 'server', 'skills');\n", '')
  .replace(original, '(bundledResources as Record<string, string>)[key]');
fs.writeFileSync(workflow, source);
fs.writeFileSync(path.join(target, 'prepared-source.json'), JSON.stringify({ source: preparedSource, commit }));
console.log('Cloudflare workspace prepared; Skill hashes verified; no local environment files copied.');
