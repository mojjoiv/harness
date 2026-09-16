#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'package.json',
  'package-lock.json',
  '.env.example',
  'docker-compose.yml',
  'apps/api/Dockerfile',
  'apps/dashboard/Dockerfile',
  'scripts/security-certification.mjs',
  'scripts/disaster-recovery-certification.mjs',
];

const requiredPackageScripts = [
  'verify:fresh-clone',
  'verify:integrations',
  'verify:woocommerce',
  'verify:joomla',
  'verify:security',
  'verify:disaster-recovery',
];

const failures = [];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.resolve(root, relativePath))) {
    failures.push(`missing required production artifact: ${relativePath}`);
  }
}

const packageJsonPath = path.resolve(root, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  for (const script of requiredPackageScripts) {
    if (!pkg.scripts?.[script]) {
      failures.push(`missing production certification script: ${script}`);
    }
  }
}

const envExamplePath = path.resolve(root, '.env.example');
if (fs.existsSync(envExamplePath)) {
  const env = fs.readFileSync(envExamplePath, 'utf8');
  for (const variable of ['DATABASE_URL', 'JWT_SECRET', 'CREDENTIAL_ENCRYPTION_KEY']) {
    if (!env.includes(`${variable}=`)) {
      failures.push(`.env.example is missing required secret/configuration placeholder: ${variable}`);
    }
  }
}

if (failures.length) {
  console.error('Final production certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Final production certification PASSED');
console.log('Production artifacts, certification scripts, secret placeholders, and deployment prerequisites are present.');
console.log('CI remains the authoritative gate for build, typecheck, tests, lint, formatting, audit, secret scanning, and integration/security/DR certification.');
