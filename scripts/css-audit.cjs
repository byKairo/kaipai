// Only remove declarations repeated verbatim under the same selector and at-rule scope.
// Keep priority, fallback values, selector order, shorthand and conditional scopes intact.
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const write = process.argv.includes('--write');
const files = fs.readdirSync('app').filter(file => file.endsWith('.css'));
let totalDuplicates = 0;
for (const file of files) {
  const filename = path.join('app', file);
  const before = fs.readFileSync(filename, 'utf8');
  const root = postcss.parse(before, { from: filename });
  let duplicates = 0;
  function clean(container) {
    const seen = new Set();
    for (const node of [...container.nodes].reverse()) {
      if (node.type === 'rule') {
        for (const declaration of [...node.nodes].reverse()) {
          if (declaration.type !== 'decl') continue;
          const key = JSON.stringify([node.selector, declaration.prop, declaration.value, Boolean(declaration.important)]);
          if (seen.has(key)) {
            duplicates++;
            declaration.remove();
          } else seen.add(key);
        }
        if (!node.nodes.length) node.remove();
      } else if (node.type === 'atrule' && node.nodes) clean(node);
    }
  }
  clean(root);
  const after = root.toString();
  if (write && duplicates) fs.writeFileSync(filename, after);
  totalDuplicates += duplicates;
  console.log(`${file}: ${Buffer.byteLength(before)} bytes, ${(before.match(/!important/g) || []).length} !important, ${duplicates} duplicate declarations${write ? ` removed (${Buffer.byteLength(before) - Buffer.byteLength(after)} bytes)` : ''}`);
}
if (!write && totalDuplicates) process.exitCode = 1;
