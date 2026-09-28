CREATE TYPE "FraudDecision" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

CREATE TABLE "fraud_risk_assessments" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "payment_id" TEXT,
  "decision" "FraudDecision" NOT NULL,
  "score" INTEGER NOT NULL,
  "reasons" JSONB NOT NULL DEFAULT '[]',
  "signals" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fraud_risk_assessments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "fraud_risk_assessments_merchant_id_created_at_idx"
  ON "fraud_risk_assessments"("merchant_id", "created_at");

CREATE INDEX "fraud_risk_assessments_merchant_id_decision_created_at_idx"
  ON "fraud_risk_assessments"("merchant_id", "decision", "created_at");

CREATE INDEX "fraud_risk_assessments_payment_id_idx"
  ON "fraud_risk_assessments"("payment_id");

ALTER TABLE "fraud_risk_assessments"
  ADD CONSTRAINT "fraud_risk_assessments_merchant_id_fkey"
  FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fraud_risk_assessments"
  ADD CONSTRAINT "fraud_risk_assessments_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
