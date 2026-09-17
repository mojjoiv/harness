CREATE TABLE "payment_receipts" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "receipt_number" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "provider_reference" TEXT,
  "payment_status" TEXT NOT NULL,
  "customer_id" TEXT,
  "customer_name" TEXT,
  "customer_email" TEXT,
  "customer_phone" TEXT,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_receipts_receipt_number_key" UNIQUE ("receipt_number"),
  CONSTRAINT "payment_receipts_payment_id_key" UNIQUE ("payment_id"),
  CONSTRAINT "payment_receipts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payment_receipts_merchant_id_issued_at_idx" ON "payment_receipts"("merchant_id", "issued_at");
CREATE INDEX "payment_receipts_merchant_id_payment_status_idx" ON "payment_receipts"("merchant_id", "payment_status");
