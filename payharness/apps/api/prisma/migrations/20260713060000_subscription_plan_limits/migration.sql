-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "subscription_plans"
  ADD COLUMN "annual_price_cents" INTEGER,
  ADD COLUMN "api_request_limit" INTEGER,
  ADD COLUMN "transaction_limit" INTEGER,
  ADD COLUMN "user_limit" INTEGER,
  ADD COLUMN "storage_limit_mb" INTEGER,
  ADD COLUMN "webhook_limit" INTEGER,
  ADD COLUMN "allowed_providers" "Provider"[] DEFAULT ARRAY[]::"Provider"[],
  ADD COLUMN "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE';
