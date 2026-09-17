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

CREATE OR REPLACE FUNCTION "create_payment_receipt_on_success"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'SUCCEEDED' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO "payment_receipts" (
      "id", "merchant_id", "payment_id", "receipt_number", "amount_cents", "currency",
      "provider", "provider_reference", "payment_status", "customer_id",
      "customer_name", "customer_email", "customer_phone"
    )
    SELECT
      md5(random()::text || clock_timestamp()::text || NEW.id)::uuid::text,
      NEW.merchant_id,
      NEW.id,
      'RCP-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text || NEW.id), 1, 10)),
      NEW.amount_cents,
      NEW.currency,
      NEW.provider::text,
      NEW.provider_reference,
      NEW.status::text,
      NEW.customer_id,
      c.name,
      c.email,
      c.phone
    FROM "customers" c
    WHERE c.id = NEW.customer_id;

    IF NOT FOUND THEN
      INSERT INTO "payment_receipts" (
        "id", "merchant_id", "payment_id", "receipt_number", "amount_cents", "currency",
        "provider", "provider_reference", "payment_status", "customer_id"
      ) VALUES (
        md5(random()::text || clock_timestamp()::text || NEW.id)::uuid::text,
        NEW.merchant_id,
        NEW.id,
        'RCP-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text || NEW.id), 1, 10)),
        NEW.amount_cents,
        NEW.currency,
        NEW.provider::text,
        NEW.provider_reference,
        NEW.status::text,
        NEW.customer_id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_success_receipt_trigger"
AFTER INSERT OR UPDATE OF "status" ON "payments"
FOR EACH ROW
EXECUTE FUNCTION "create_payment_receipt_on_success"();
