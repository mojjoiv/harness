CREATE TYPE "PlatformRole" AS ENUM (
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'SUPPORT',
  'FINANCE',
  'COMPLIANCE'
);

CREATE TYPE "PlatformUserStatus" AS ENUM (
  'ACTIVE',
  'SUSPENDED',
  'DISABLED'
);

CREATE TABLE "platform_users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "PlatformRole" NOT NULL,
  "status" "PlatformUserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "last_login" TIMESTAMP(3),
  CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

DELETE FROM "merchant_users" WHERE "role" = 'SUPERADMIN';

CREATE TYPE "UserRole_new" AS ENUM (
  'OWNER',
  'ADMIN',
  'DEVELOPER',
  'VIEWER'
);

ALTER TABLE "merchant_users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new"),
  ALTER COLUMN "role" SET DEFAULT 'OWNER';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
