const { spawnSync } = require("node:child_process");

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

let directDatabaseUrl;

try {
  const url = new URL(databaseUrl);
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, "");
  directDatabaseUrl = url.toString();
} catch (error) {
  console.error("DATABASE_URL is not a valid URL.");
  console.error(error);
  process.exit(1);
}

const env = {
  ...process.env,
  DIRECT_DATABASE_URL: directDatabaseUrl,
};

const commands = [
  ["prisma", ["generate"]],
  ["prisma", ["migrate", "deploy"]],
  ["ts-node", ["prisma/seed.ts"]],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: false,
  });

  if (result.error) {
    console.error(`Failed to start ${command}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
