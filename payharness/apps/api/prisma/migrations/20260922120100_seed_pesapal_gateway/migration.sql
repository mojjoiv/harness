INSERT INTO "platform_gateway_configs" ("id", "provider", "enabled", "updated_at")
VALUES (gen_random_uuid(), 'PESAPAL', true, CURRENT_TIMESTAMP)
ON CONFLICT ("provider") DO NOTHING;

INSERT INTO "provider_country_availability" ("id", "provider", "country_code", "enabled", "updated_at")
VALUES
  (gen_random_uuid(), 'PESAPAL', 'KE', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PESAPAL', 'UG', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PESAPAL', 'TZ', true, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'PESAPAL', 'RW', true, CURRENT_TIMESTAMP)
ON CONFLICT ("provider", "country_code") DO NOTHING;
