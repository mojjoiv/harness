CREATE UNIQUE INDEX IF NOT EXISTS "payments_merchant_provider_environment_reference_key"
ON "payments" ("merchant_id", "provider", "environment", "provider_reference")
WHERE "provider_reference" IS NOT NULL;
