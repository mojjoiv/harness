/* eslint-disable @typescript-eslint/no-require-imports */
const { execFileSync } = require('node:child_process');
const path = require('node:path');
/* eslint-enable @typescript-eslint/no-require-imports */

const eventName = process.env.GITHUB_EVENT_NAME;
const baseRef = process.env.GITHUB_BASE_REF;
const beforeSha = process.env.GITHUB_EVENT_BEFORE;
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim();

let base;
if (eventName === 'pull_request' && baseRef) {
  base = `origin/${baseRef}`;
} else if (beforeSha && !/^0+$/.test(beforeSha)) {
  base = beforeSha;
} else {
  base = 'HEAD^';
}

const files = execFileSync(
  'git',
  [
    'diff',
    '--name-only',
    base,
    'HEAD',
    '--',
    '*.js',
    '*.jsx',
    '*.ts',
    '*.tsx',
    '*.json',
    '*.css',
    '*.md',
    '*.yml',
    '*.yaml',
  ],
  { encoding: 'utf8' },
)
  .split('\n')
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !file.startsWith('node_modules/'))
  .map((file) => path.resolve(repoRoot, file));

if (files.length === 0) {
  console.log(`No supported files changed since ${base}; formatting check passed.`);
  process.exit(0);
}

console.log(`Formatting ${files.length} changed file(s) for diagnostic output...`);

const prettierBin = require.resolve('prettier/bin/prettier.cjs');
execFileSync(process.execPath, [prettierBin, '--write', ...files], {
  stdio: 'inherit',
});

console.log('--- PRETTIER DIAGNOSTIC DIFF START ---');
try {
  const diff = execFileSync('git', ['diff', '--', ...files], { encoding: 'utf8' });
  console.log(diff || '(no formatting changes required)');
} catch (error) {
  console.log(`Unable to render diagnostic diff: ${error.message}`);
}
console.log('--- PRETTIER DIAGNOSTIC DIFF END ---');
