/** Offline TypeScript execution using the project's existing compiler. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function compile(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: filename.replace(/\.mts$/, '.ts'),
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  module._compile(result.outputText, filename);
}
require.extensions['.ts'] = compile;
require.extensions['.mts'] = compile;
async function main() {
for (const filename of ['tests/style-prototypes.test.ts', 'tests/ai-workbench.test.ts', 'tests/article-review.test.ts', 'tests/cover-design.test.ts', 'tests/request-origin.test.ts', 'tests/credential-framework.test.ts', 'scripts/wechat-compliance-smoke.ts', 'scripts/heading-contrast-smoke.mts', 'tests/article-styles.test.ts', 'tests/wechat-publication.test.ts', 'tests/server-endpoint.test.ts', 'tests/wechat-html.test.ts', 'tests/link-security.test.ts', 'tests/storage-import-export.test.ts', 'tests/request-scope.test.ts', 'tests/css-cleanup.test.ts', 'tests/autosave.test.ts']) {
  console.log(`\nRunning ${filename}`);
  const suite = require(path.resolve(__dirname, '..', filename));
  if (suite.run) await suite.run();
}
}
main().catch(error => { console.error(error); process.exitCode = 1; });
