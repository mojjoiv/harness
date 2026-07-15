-- AlterTable
ALTER TABLE "provider_credentials"
  ADD COLUMN "is_default" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "last_verified_at" TIMESTAMP(3),
  ADD COLUMN "last_verification_error" TEXT,
  ADD COLUMN "failed_verification_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "merchant_settings"
  ADD COLUMN "success_url" TEXT,
  ADD COLUMN "cancel_url" TEXT,
  ADD COLUMN "webhook_forwarding_url" TEXT;
