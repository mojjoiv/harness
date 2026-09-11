CREATE TABLE "payouts" (
  "id" UUID NOT NULL,
  "merchant_id" UUID NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "provider" "Provider" NOT NULL,
  "environment" "Environment" NOT NULL DEFAULT 'SANDBOX',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "recipient_type" TEXT NOT NULL,
  "recipient_phone" TEXT,
  "recipient_name" TEXT,
  "provider_reference" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "failure_reason" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payouts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payouts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payouts_status_check" CHECK ("status" IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED')),
  CONSTRAINT "payouts_amount_check" CHECK ("amount_cents" > 0)
);

CREATE UNIQUE INDEX "payouts_merchant_environment_idempotency_key_key"
  ON "payouts"("merchant_id", "environment", "idempotency_key");

CREATE INDEX "payouts_merchant_id_created_at_idx"
  ON "payouts"("merchant_id", "created_at");

CREATE INDEX "payouts_provider_reference_idx"
  ON "payouts"("provider_reference");