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

console.log(`Checking formatting for ${files.length} changed file(s)...`);

const prettierBin = require.resolve('prettier/bin/prettier.cjs');
execFileSync(process.execPath, [prettierBin, '--check', ...files], {
  stdio: 'inherit',
});
