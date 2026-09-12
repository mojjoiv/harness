CREATE TABLE "payout_reconciliation_attempts" (
  "id" UUID NOT NULL,
  "payout_id" UUID NOT NULL,
  "merchant_id" UUID NOT NULL,
  "provider" "Provider" NOT NULL,
  "outcome" TEXT NOT NULL,
  "provider_status" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payout_reconciliation_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payout_reconciliation_attempts_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payout_reconciliation_attempts_payout_id_attempted_at_idx"
  ON "payout_reconciliation_attempts"("payout_id", "attempted_at");

CREATE INDEX "payout_reconciliation_attempts_merchant_id_attempted_at_idx"
  ON "payout_reconciliation_attempts"("merchant_id", "attempted_at");
