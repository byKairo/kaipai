const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inspectTree } = require('../scripts/deployment-safety.cjs');
exports.run = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kaipai-publish-test-'));
  try {
    fs.writeFileSync(path.join(dir, 'safe.js'), 'export const key = process.env.KAIPAI_CREDENTIAL_KEYS;');
    assert.equal(inspectTree(dir, 'test'), 1);
    const blocked = path.join(dir, '.env.local');
    fs.writeFileSync(blocked, 'dummy only');
    assert.throws(() => inspectTree(dir, 'test'), /forbidden deployment entry/);
    fs.unlinkSync(blocked);
    fs.symlinkSync(path.join(dir, 'safe.js'), path.join(dir, 'linked.js'));
    assert.throws(() => inspectTree(dir, 'test'), /forbidden deployment entry/);
    fs.unlinkSync(path.join(dir, 'linked.js'));
    const dummy = ['sk-', 'D'.repeat(40)].join('');
    fs.writeFileSync(path.join(dir, 'unsafe.js'), dummy);
    assert.throws(() => inspectTree(dir, 'test'), error => error.message.includes('possible credential') && !error.message.includes(dummy));
    fs.writeFileSync(path.join(dir, 'unsafe.js'), JSON.stringify({ active: 'a', keys: { a: Buffer.alloc(32, 1).toString('base64') } }));
    assert.throws(() => inspectTree(dir, 'test'), /possible credential/);
    console.log('PASS: publish guard blocks environment files, symlinks and credential signatures without printing secrets');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
