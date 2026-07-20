-- CreateEnum
CREATE TYPE "ProviderVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'PARTIALLY_VERIFIED', 'FAILED');

-- AlterTable
ALTER TABLE "provider_credentials"
  ADD COLUMN "verification_status" "ProviderVerificationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "oauth_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "account_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "webhook_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "environment_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verification_latency_ms" INTEGER,
  ADD COLUMN "verification_warnings" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "verification_errors" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "provider_verification_logs"
  ADD COLUMN "warnings" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "errors" JSONB NOT NULL DEFAULT '[]';
