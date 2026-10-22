/** Fail closed before publishing; diagnostics deliberately never print matched secret text. */
const fs = require('node:fs');
const path = require('node:path');
const inputDirs = ['app', 'lib', 'server', 'public'];
const forbiddenName = /^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|\.npmrc|\.git|\.wrangler|id_rsa|id_ed25519)$|\.(?:pem|key|p12|pfx)$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{30,}\b/,
  /\bsk-(?:proj-|ant-api\d+-)?[A-Za-z0-9_-]{32,}\b/,
  /"active"\s*:\s*"[\w-]+"\s*,\s*"keys"\s*:\s*\{\s*"[\w-]+"\s*:\s*"[A-Za-z0-9+/]{43}="/,
];
function inspectTree(root, label) {
  let count = 0;
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      const relative = path.relative(root, file);
      if (entry.isSymbolicLink() || forbiddenName.test(entry.name)) throw new Error(`${label}: forbidden deployment entry (${relative})`);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) {
        const data = fs.readFileSync(file);
        // Text signatures are ASCII; binary files are checked as well.
        if (secretPatterns.some(pattern => pattern.test(data.toString('utf8')))) throw new Error(`${label}: possible credential material (${relative}); matched value withheld`);
        count++;
      }
    }
  }
  visit(root);
  return count;
}
function assertSafeDeploymentInputs(root) {
  let count = 0;
  for (const name of inputDirs) count += inspectTree(path.join(root, name), name);
  return count;
}
module.exports = { assertSafeDeploymentInputs, inspectTree };
if (require.main === module) {
  try {
    const root = path.resolve(__dirname, '..');
    const count = process.argv.includes('--artifacts')
      ? inspectTree(path.join(root, '.cloudflare-deploy/dist/client'), 'public build')
      : assertSafeDeploymentInputs(root);
    console.log(`PASS: inspected ${count} deployment files; no forbidden entries or recognized credential signatures.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
