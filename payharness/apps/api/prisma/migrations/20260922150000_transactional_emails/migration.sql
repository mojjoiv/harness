CREATE TYPE "TransactionalEmailStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'FAILED');

CREATE TYPE "TransactionalEmailEventType" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINT');

CREATE TABLE "transactional_emails" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "payment_id" TEXT,
  "template_key" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "status" "TransactionalEmailStatus" NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3),
  "provider_message_id" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  CONSTRAINT "transactional_emails_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transactional_emails_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transactional_emails_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "transactional_emails_merchant_id_idempotency_key_key"
  ON "transactional_emails" ("merchant_id", "idempotency_key");

CREATE UNIQUE INDEX "transactional_emails_provider_message_id_key"
  ON "transactional_emails" ("provider_message_id")
  WHERE "provider_message_id" IS NOT NULL;

CREATE INDEX "transactional_emails_merchant_id_created_at_idx"
  ON "transactional_emails" ("merchant_id", "created_at");

CREATE INDEX "transactional_emails_status_next_attempt_at_idx"
  ON "transactional_emails" ("status", "next_attempt_at");

CREATE TABLE "transactional_email_events" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "transactional_email_id" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "type" "TransactionalEmailEventType" NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transactional_email_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transactional_email_events_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "transactional_email_events_email_id_fkey" FOREIGN KEY ("transactional_email_id") REFERENCES "transactional_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "transactional_email_events_provider_event_id_key"
  ON "transactional_email_events" ("provider_event_id");

CREATE INDEX "transactional_email_events_merchant_id_created_at_idx"
  ON "transactional_email_events" ("merchant_id", "created_at");

CREATE INDEX "transactional_email_events_email_id_created_at_idx"
  ON "transactional_email_events" ("transactional_email_id", "created_at");
