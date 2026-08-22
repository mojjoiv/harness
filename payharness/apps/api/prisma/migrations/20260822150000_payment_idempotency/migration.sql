CREATE TABLE "payment_idempotency_keys" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "response_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_idempotency_keys_merchant_environment_key_key"
ON "payment_idempotency_keys"("merchant_id", "environment", "idempotency_key");

CREATE INDEX "payment_idempotency_keys_merchant_created_at_idx"
ON "payment_idempotency_keys"("merchant_id", "created_at");

ALTER TABLE "payment_idempotency_keys"
ADD CONSTRAINT "payment_idempotency_keys_merchant_id_fkey"
FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
