CREATE TABLE "ledger_journals" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_journals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ledger_journals_source_type_source_id_key"
  ON "ledger_journals"("source_type", "source_id");

CREATE INDEX "ledger_journals_merchant_id_created_at_idx"
  ON "ledger_journals"("merchant_id", "created_at");

CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "journal_id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "account_code" TEXT NOT NULL,
  "side" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ledger_entries_side_check" CHECK ("side" IN ('DEBIT', 'CREDIT')),
  CONSTRAINT "ledger_entries_amount_check" CHECK ("amount_cents" > 0),
  CONSTRAINT "ledger_entries_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "ledger_entries_journal_fk"
    FOREIGN KEY ("journal_id") REFERENCES "ledger_journals"("id") ON DELETE CASCADE
);

CREATE INDEX "ledger_entries_merchant_account_idx"
  ON "ledger_entries"("merchant_id", "account_code", "currency", "created_at");
