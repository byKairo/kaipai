/** Package only extension runtime files; never include articles, credentials or test artifacts. */
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const JSZip = require('jszip');
async function main() {
  const root = path.resolve(__dirname, '../extensions/kaipai-wechat');
  const destination = path.resolve(process.argv[2] || path.join(os.homedir(), 'Downloads'));
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version)) throw new Error('Invalid extension version');
  const names = (await fs.readdir(root)).filter(name => ['manifest.json', 'README.md'].includes(name) || /\.(js|css|html)$/.test(name)).sort();
  const contents = new Map(await Promise.all(names.map(async name => [name, await fs.readFile(path.join(root, name))])));
  if (!contents.get('prepare.html')?.toString().includes('插件版本：' + manifest.version)) throw new Error('Manifest and visible version do not match');
  for (const [name, bytes] of contents) {
    if (!name.endsWith('.js')) continue;
    for (const match of bytes.toString().matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)) {
      if (!contents.has(match[1])) throw new Error(`Missing packaged import: ${match[1]}`);
    }
  }
  await fs.mkdir(destination, { recursive: true });
  const target = path.join(destination, 'kaipai-wechat');
  try {
    const previous = JSON.parse(await fs.readFile(path.join(target, 'manifest.json'), 'utf8'));
    if (previous.name !== manifest.name) throw new Error('Destination belongs to another extension');
    const backup = new JSZip(); const hash = crypto.createHash('sha256');
    for (const name of names) {
      try { const bytes = await fs.readFile(path.join(target, name)); backup.file('kaipai-wechat/' + name, bytes); hash.update(name).update(bytes); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const backupName = `kaipai-wechat-backup-${previous.version}-${hash.digest('hex').slice(0, 8)}.zip`;
    await fs.writeFile(path.join(destination, backupName), await backup.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const archive = new JSZip();
  for (const [name, bytes] of contents) archive.file('kaipai-wechat/' + name, bytes);
  const buffer = await archive.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const recovered = await JSZip.loadAsync(buffer);
  for (const [name, bytes] of contents) {
    if (!(await recovered.file('kaipai-wechat/' + name).async('nodebuffer')).equals(bytes)) throw new Error('Archive content mismatch');
  }
  const zip = path.join(destination, `kaipai-wechat-${manifest.version}.zip`);
  await fs.writeFile(zip, buffer);
  await fs.mkdir(target, { recursive: true });
  for (const [name, bytes] of contents) await fs.writeFile(path.join(target, name), bytes);
  for (const [name, bytes] of contents) {
    if (!(await fs.readFile(path.join(target, name))).equals(bytes)) throw new Error('Extracted content mismatch');
  }
  console.log(JSON.stringify({ version: manifest.version, zip, folder: target, verifiedFiles: names.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
