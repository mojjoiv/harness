#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'apps/api/Dockerfile',
  'apps/dashboard/Dockerfile',
  'apps/api/docker-entrypoint.sh',
  'docker-compose.yml',
  'render.yaml',
  'docs/PRODUCTION_INFRASTRUCTURE.md',
  'docs/DISASTER_RECOVERY.md',
  'scripts/backup-database.sh',
  'scripts/restore-database.sh',
];

const failures = [];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.resolve(root, relativePath))) {
    failures.push(`missing production infrastructure artifact: ${relativePath}`);
  }
}

const apiDockerfile = path.resolve(root, 'apps/api/Dockerfile');
if (fs.existsSync(apiDockerfile)) {
  const content = fs.readFileSync(apiDockerfile, 'utf8');
  for (const required of ['npm prune --omit=dev', 'USER node', 'HEALTHCHECK', 'CMD ["node", "dist/main.js"]']) {
    if (!content.includes(required)) failures.push(`API Dockerfile is missing hardening control: ${required}`);
  }
}

const dashboardDockerfile = path.resolve(root, 'apps/dashboard/Dockerfile');
if (fs.existsSync(dashboardDockerfile)) {
  const content = fs.readFileSync(dashboardDockerfile, 'utf8');
  for (const required of ['npm prune --omit=dev', 'USER node', 'HEALTHCHECK']) {
    if (!content.includes(required)) failures.push(`dashboard Dockerfile is missing hardening control: ${required}`);
  }
}

const compose = path.resolve(root, 'docker-compose.yml');
if (fs.existsSync(compose)) {
  const content = fs.readFileSync(compose, 'utf8');
  for (const required of ['migrate:', 'condition: service_completed_successfully', 'readiness']) {
    if (!content.includes(required)) failures.push(`docker-compose.yml is missing production startup control: ${required}`);
  }
}

const render = path.resolve(root, 'render.yaml');
if (fs.existsSync(render)) {
  const content = fs.readFileSync(render, 'utf8');
  for (const required of ['preDeployCommand: npm run db:setup', 'startCommand: npm run start:prod']) {
    if (!content.includes(required)) failures.push(`Render deployment is missing separation of migration/startup: ${required}`);
  }
}

const workflow = path.resolve(root, '../.github/workflows/container-release.yml');
if (!fs.existsSync(workflow)) failures.push('missing immutable container release workflow');

if (failures.length) {
  console.error('Production infrastructure certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Production infrastructure certification PASSED');
