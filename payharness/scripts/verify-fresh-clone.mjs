#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error(`Fresh-clone check failed: ${message}`);
  process.exit(1);
}

function requireFile(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    fail(`missing required file: ${relativePath}`);
  }
}

function requireNodeVersion() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 20 || (major === 20 && minor < 11)) {
    fail(`Node.js >=20.11.1 is required; found ${process.version}`);
  }
}

function validateCompose() {
  try {
    execFileSync('docker', ['compose', 'config', '--quiet'], {
      cwd: root,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'development',
      },
    });
  } catch (error) {
    const output = [error.stdout, error.stderr]
      .filter(Boolean)
      .map((value) => value.toString().trim())
      .filter(Boolean)
      .join('\n');
    fail(`docker compose configuration is invalid or Docker Compose is unavailable${output ? `:\n${output}` : '.'}`);
  }
}

requireNodeVersion();
requireFile('package.json');
requireFile('package-lock.json');
requireFile('.env.example');
requireFile('docker-compose.yml');
requireFile('apps/api/Dockerfile');
requireFile('apps/dashboard/Dockerfile');
validateCompose();

console.log('Fresh-clone prerequisites are valid.');
console.log(`Node.js: ${process.version}`);
console.log('npm lockfile: present');
console.log('root .env.example: present');
console.log('Docker Compose: valid');
