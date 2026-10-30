import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { editorPreloadHref, bindEditorPreload } = require('../scripts/editor-preload.cjs');

export function run() {
  const manifest = { 'app/rich-editor.tsx': { file: '_next/static/chunks/current-editor-abc.js' } };
  assert.equal(editorPreloadHref(manifest), '/_next/static/chunks/current-editor-abc.js');
  for (const file of [undefined, '../old.js', '_next/static/chunks/a.js?old=1', 'https://elsewhere.test/editor.js', '_next/static/chunks/"bad.js']) {
    assert.throws(() => editorPreloadHref({ 'app/rich-editor.tsx': { file } }), /Missing or invalid/);
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kaipai-preload-test-'));
  try {
    fs.mkdirSync(path.join(directory, 'chunks'));
    const file = path.join(directory, 'chunks/worker.js');
    fs.writeFileSync(file, 'const href = "__KAIPAI_EDITOR_PRELOAD_HREF__";');
    assert.deepEqual(bindEditorPreload(directory, manifest), { href: '/_next/static/chunks/current-editor-abc.js', replacements: 1 });
    assert.equal(fs.readFileSync(file, 'utf8'), 'const href = "/_next/static/chunks/current-editor-abc.js";');
    assert.throws(() => bindEditorPreload(directory, manifest), /marker missing/, 'a changed compiler output must fail closed rather than ship an unbound hint');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  console.log('PASS: editor preload uses this build manifest and rejects missing, stale or unsafe chunk bindings');
}
