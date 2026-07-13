-- AlterTable: add label to provider_credentials so a merchant can hold
-- multiple named credentials per provider/environment (e.g. two M-Pesa
-- paybills). Existing rows default to "default" so nothing is lost.
ALTER TABLE "provider_credentials" ADD COLUMN "label" TEXT NOT NULL DEFAULT 'default';

-- Replace the old (merchant, provider, environment) unique index with one
-- that also includes label.
DROP INDEX "provider_credentials_merchant_id_provider_environment_key";
CREATE UNIQUE INDEX "provider_credentials_merchant_id_provider_environment_label_key" ON "provider_credentials"("merchant_id", "provider", "environment", "label");

-- CreateTable
CREATE TABLE "platform_gateway_configs" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_gateway_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_gateway_configs_provider_key" ON "platform_gateway_configs"("provider");
