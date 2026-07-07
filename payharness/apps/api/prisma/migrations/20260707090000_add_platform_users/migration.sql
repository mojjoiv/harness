DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformRole') THEN
    CREATE TYPE "PlatformRole" AS ENUM (
      'SUPERADMIN',
      'PLATFORM_ADMIN',
      'SUPPORT',
      'FINANCE',
      'COMPLIANCE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformUserStatus') THEN
    CREATE TYPE "PlatformUserStatus" AS ENUM (
      'ACTIVE',
      'SUSPENDED',
      'DISABLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "platform_users" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "platform_users_email_key" ON "platform_users"("email");

INSERT INTO "platform_users" (
  "id",
  "email",
  "password",
  "name",
  "role",
  "status",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON (u."email")
  u."id",
  u."email",
  u."password_hash",
  u."name",
  'SUPERADMIN'::"PlatformRole",
  'ACTIVE'::"PlatformUserStatus",
  u."created_at",
  u."updated_at"
FROM "users" u
INNER JOIN "merchant_users" mu ON mu."user_id" = u."id"
WHERE mu."role" = 'SUPERADMIN'
ORDER BY u."email", u."created_at" ASC
ON CONFLICT ("email") DO UPDATE SET
  "password" = EXCLUDED."password",
  "name" = EXCLUDED."name",
  "role" = 'SUPERADMIN'::"PlatformRole",
  "status" = 'ACTIVE'::"PlatformUserStatus",
  "updated_at" = CURRENT_TIMESTAMP;

CREATE TYPE "UserRole_new" AS ENUM (
  'OWNER',
  'ADMIN',
  'DEVELOPER',
  'VIEWER'
);

DELETE FROM "merchant_users" WHERE "role" = 'SUPERADMIN';

ALTER TABLE "merchant_users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new"),
  ALTER COLUMN "role" SET DEFAULT 'OWNER';

ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "UserRole_old";
