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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_receipts_payment_id_key" UNIQUE ("payment_id"),
    CONSTRAINT "payment_receipts_merchant_id_receipt_number_key" UNIQUE ("merchant_id", "receipt_number"),
    CONSTRAINT "payment_receipts_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_receipts_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payment_receipts_merchant_id_idx" ON "payment_receipts"("merchant_id");

CREATE OR REPLACE FUNCTION "create_payment_receipt"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUCCEEDED' THEN
    INSERT INTO "payment_receipts" (
      "id",
      "merchant_id",
      "payment_id",
      "receipt_number",
      "amount_cents",
      "currency",
      "provider",
      "provider_reference",
      "payment_status",
      "customer_id",
      "customer_name",
      "customer_email",
      "customer_phone"
    )
    SELECT
      md5(random()::text || clock_timestamp()::text || NEW.id),
      NEW.merchant_id,
      NEW.id,
      'RCP-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text || NEW.id), 1, 10)),
      NEW.amount_cents,
      NEW.currency,
      NEW.provider::text,
      NEW.provider_reference,
      NEW.status::text,
      NEW.customer_id,
      C.name,
      C.email,
      C.phone
    FROM (SELECT 1) AS source
    LEFT JOIN "customers" C ON C.id = NEW.customer_id
    WHERE NOT EXISTS (
      SELECT 1 FROM "payment_receipts" R WHERE R.payment_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payments_create_receipt_trigger"
AFTER INSERT OR UPDATE OF "status" ON "payments"
FOR EACH ROW
EXECUTE FUNCTION "create_payment_receipt"();