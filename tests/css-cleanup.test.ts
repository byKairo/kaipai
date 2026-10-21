import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const postcss = require('postcss');

const source = `
.card { color: red; margin: 1px; display: -webkit-box; display: flex; }
@media (min-width: 800px) { .card { color: green; margin-left: 4px; } .card { color: green; } }
.card { margin-left: 9px; color: blue; }
@supports (display: grid) { .card { display: grid; } }
.card { margin: 1px; color: red; color: red !important; }
@media (max-width: 799px) { .card { color: blue !important; } }
.card { color: red; }
.card { display: grid; display: flex; }
.card { --ink: red; color: var(--ink); }
`;
function cascade(css: string, width: number, supportsGrid: boolean, supportsFlex: boolean) {
  const values: Record<string, { value: string; important: boolean }> = {};
  function set(property: string, value: string, important: boolean) {
    if (values[property]?.important && !important) return;
    values[property] = { value, important };
  }
  function walk(container: any) {
    for (const node of container.nodes ?? []) {
      if (node.type === 'atrule') {
        if (node.name === 'media' && ((node.params.includes('min-width') && width < 800) || (node.params.includes('max-width') && width >= 800))) continue;
        if (node.name === 'supports' && !supportsGrid) continue;
        walk(node);
      }
      if (node.type !== 'rule' || node.selector !== '.card') continue;
      for (const decl of node.nodes) {
        if (decl.type !== 'decl') continue;
        if (decl.prop === 'display' && ((decl.value === 'grid' && !supportsGrid) || (decl.value === 'flex' && !supportsFlex))) continue;
        if (decl.prop === 'margin') for (const side of ['top', 'right', 'bottom', 'left']) set(`margin-${side}`, decl.value, !!decl.important);
        else set(decl.prop, decl.value, !!decl.important);
      }
    }
  }
  walk(postcss.parse(css));
  return values;
}
const directory = mkdtempSync(join(tmpdir(), 'kaipai-css-test-'));
try {
  mkdirSync(join(directory, 'app'));
  const fixture = join(directory, 'app', 'fixture.css');
  writeFileSync(fixture, source);
  const script = resolve(__dirname, '../scripts/css-audit.cjs');
  const audit = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(audit.status, 1, 'audit reports duplicate declarations');
  assert.equal(readFileSync(fixture, 'utf8'), source, 'audit is read-only');
  const cleanup = spawnSync(process.execPath, [script, '--write'], { cwd: directory, encoding: 'utf8' });
  assert.equal(cleanup.status, 0, cleanup.stderr);
  const cleaned = readFileSync(fixture, 'utf8');
  assert.ok(cleaned.length < source.length);
  for (const width of [600, 1000]) for (const grid of [false, true]) for (const flex of [false, true]) {
    assert.deepEqual(cascade(cleaned, width, grid, flex), cascade(source, width, grid, flex), `cascade changed for width=${width}, grid=${grid}, flex=${flex}`);
  }
  assert.ok(cleaned.includes('display: -webkit-box'), 'unsupported newer display retains old browser fallback');
  assert.ok(cleaned.includes('color: red !important'), 'priority must remain separate');
  assert.ok(cleaned.includes('color: green'), 'conditional declarations remain scoped');
  assert.ok(cleaned.includes('--ink: red'), 'custom properties survive');
  const second = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' });
  assert.equal(second.status, 0, second.stdout + second.stderr);
  console.log('PASS: CSS cleanup preserves shorthand, fallback, important, custom properties and media/supports cascade across 8 scenarios');
} finally { rmSync(directory, { recursive: true, force: true }); }
