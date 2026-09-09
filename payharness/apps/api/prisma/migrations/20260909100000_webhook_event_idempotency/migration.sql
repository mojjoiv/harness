ALTER TABLE "webhook_deliveries"
ADD COLUMN "provider_event_id" TEXT;

CREATE UNIQUE INDEX "webhook_deliveries_provider_provider_event_id_key"
ON "webhook_deliveries"("provider", "provider_event_id");

CREATE INDEX "webhook_deliveries_provider_event_id_idx"
ON "webhook_deliveries"("provider_event_id");
