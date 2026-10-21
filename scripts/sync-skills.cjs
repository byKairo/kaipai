// Explicit developer operation: snapshot owned Skill resources for portable deployment.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = process.argv[2] || path.join(require('node:os').homedir(), '.agents/skills');
const destination = path.resolve(__dirname, '../server/skills');
const manifest = { schema: 1, skills: {} };
const snapshots = new Map();
for (const name of ['kairo-layout', 'kairo-design']) {
  const root = path.join(source, name);
  if (!fs.existsSync(path.join(root, 'SKILL.md'))) throw new Error(`Missing ${name}/SKILL.md`);
  const files = {};
  const contents = new Map();
  function copy(relative) {
    const from = path.join(root, relative);
    if (!fs.existsSync(from)) return;
    const stat = fs.lstatSync(from);
    if (stat.isSymbolicLink()) throw new Error('Skill snapshots cannot contain symlinks');
    if (stat.isDirectory()) { for (const child of fs.readdirSync(from).sort()) copy(path.join(relative, child)); return; }
    if (!/\.(md|json|py)$/.test(relative)) return;
    const bytes = fs.readFileSync(from);
    contents.set(relative, bytes);
    files[relative] = crypto.createHash('sha256').update(bytes).digest('hex');
  }
  for (const entry of ['SKILL.md', 'catalog.json', 'routes', 'references', 'styles', 'scripts']) copy(entry);
  manifest.skills[name] = { version: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12), files };
  snapshots.set(name, contents);
}
// Read and validate both sources before replacing only these owned snapshots.
// This also makes syncing a snapshot directory into itself safe.
for (const [name, contents] of snapshots) {
  fs.rmSync(path.join(destination, name), { recursive: true, force: true });
  for (const [relative, bytes] of contents) {
    const target = path.join(destination, name, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
}
fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Snapshotted kairo-layout and kairo-design; versions recorded in server/skills/manifest.json');
