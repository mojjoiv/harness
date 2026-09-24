ALTER TABLE "webhook_deliveries" ADD COLUMN "failure_reason" TEXT;

UPDATE "webhook_deliveries"
SET "failure_reason" = "response_body"
WHERE "status" = 'FAILED'::"Status"
  AND "failure_reason" IS NULL
  AND "response_body" IS NOT NULL;