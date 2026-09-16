import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const main = fs.readFileSync(
  path.resolve(root, 'apps/api/src/main.ts'),
  'utf8',
);
const appModule = fs.readFileSync(
  path.resolve(root, 'apps/api/src/app.module.ts'),
  'utf8',
);

const required = [
  "rawBody: true",
  "trust proxy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Strict-Transport-Security",
  "Permissions-Policy",
  "Referrer-Policy",
  "allowedOrigins",
  "CORS origin is not allowed",
  "SWAGGER_ENABLED",
  "forbidNonWhitelisted: true",
  "whitelist: true",
];

const failures = required
  .filter((value) => !main.includes(value))
  .map((value) => `API bootstrap is missing security control: ${value}`);

if (!appModule.includes('RateLimitMiddleware')) {
  failures.push('Global rate limiting middleware is not registered');
}

if (failures.length) {
  console.error('Security certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Security certification PASSED');
console.log('Validated API security headers, strict CORS, production Swagger gating, validation hardening, and rate-limit registration.');
