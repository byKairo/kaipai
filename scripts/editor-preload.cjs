/** Bind the streaming Worker hint to this build's content-hashed editor file. */
const fs = require('node:fs');
const path = require('node:path');
const token = '__KAIPAI_EDITOR_PRELOAD_HREF__';
function editorPreloadHref(manifest) {
  const file = manifest['app/rich-editor.tsx']?.file;
  if (typeof file !== 'string' || !/^_next\/static\/chunks\/[A-Za-z0-9_.~-]+\.js$/.test(file)) {
    throw new Error('Missing or invalid rich editor chunk; refusing a stale preload hint');
  }
  return '/' + file;
}
function bindEditorPreload(server, manifest) {
  const href = editorPreloadHref(manifest);
  let replacements = 0;
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name.endsWith('.js')) {
        const source = fs.readFileSync(file, 'utf8');
        const count = source.split(token).length - 1;
        if (count) {
          fs.writeFileSync(file, source.split(token).join(href));
          replacements += count;
        }
      }
    }
  }
  visit(server);
  if (!replacements) throw new Error('Editor preload marker missing from Worker build');
  return { href, replacements };
}
module.exports = { editorPreloadHref, bindEditorPreload };
