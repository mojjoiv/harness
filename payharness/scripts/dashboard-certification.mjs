import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const dashboardRoot = path.join(root, 'apps', 'dashboard');
const pagesRoot = path.join(dashboardRoot, 'src', 'pages');

const requiredPages = [
  ['Developer Portal', path.join(pagesRoot, 'developers', 'index.tsx'), [
    'Developer Portal',
    '/developers/api-keys',
    '/developers/webhooks',
    '/developers/usage',
    '/developers/docs',
    'Quickstart',
    'Official SDKs',
  ]],
  ['Developer API Keys', path.join(pagesRoot, 'developers', 'api-keys.tsx'), ['API Keys', 'sandbox', 'live']],
  ['Developer Usage', path.join(pagesRoot, 'developers', 'usage.tsx'), ['Usage']],
  ['Developer Webhooks', path.join(pagesRoot, 'developers', 'webhooks.tsx'), ['Webhooks', 'signature', 'delivery']],
  ['Developer API Reference', path.join(pagesRoot, 'developers', 'docs.tsx'), ['API Reference', 'POST /payments', 'idempotency', 'webhook']],
];

const failures = [];

for (const [name, file, requiredStrings] of requiredPages) {
  if (!fs.existsSync(file)) {
    failures.push(`${name}: missing ${path.relative(root, file)}`);
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  for (const required of requiredStrings) {
    if (!source.toLowerCase().includes(required.toLowerCase())) {
      failures.push(`${name}: missing expected UI contract text "${required}"`);
    }
  }
}

const layoutFile = path.join(dashboardRoot, 'src', 'components', 'layout.tsx');
if (!fs.existsSync(layoutFile)) {
  failures.push('Dashboard layout: missing src/components/layout.tsx');
} else {
  const layout = fs.readFileSync(layoutFile, 'utf8');
  for (const required of ['/developers', 'Developer Portal']) {
    if (!layout.includes(required)) {
      failures.push(`Dashboard navigation: missing "${required}"`);
    }
  }
}

const packageFile = path.join(dashboardRoot, 'package.json');
if (!fs.existsSync(packageFile)) {
  failures.push('Dashboard package: missing apps/dashboard/package.json');
} else {
  const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  if (pkg.scripts?.test !== 'jest --runInBand') {
    failures.push('Dashboard package: expected Jest test command is missing');
  }
}

if (failures.length > 0) {
  console.error('Dashboard certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Dashboard certification PASSED');
console.log(`- ${requiredPages.length} developer UI surfaces verified`);
console.log('- Developer navigation verified');
console.log('- Dashboard Jest test command verified');
