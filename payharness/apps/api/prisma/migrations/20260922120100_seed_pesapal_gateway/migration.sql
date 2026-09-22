INSERT INTO "platform_gateway_configs" ("id", "provider", "enabled", "updated_at")
VALUES (md5('PESAPAL')::uuid, 'PESAPAL', true, CURRENT_TIMESTAMP)
ON CONFLICT ("provider") DO NOTHING;

INSERT INTO "provider_country_availability" ("id", "provider", "country_code", "enabled", "updated_at")
VALUES
  (md5('PESAPAL:KE')::uuid, 'PESAPAL', 'KE', true, CURRENT_TIMESTAMP),
  (md5('PESAPAL:UG')::uuid, 'PESAPAL', 'UG', true, CURRENT_TIMESTAMP),
  (md5('PESAPAL:TZ')::uuid, 'PESAPAL', 'TZ', true, CURRENT_TIMESTAMP),
  (md5('PESAPAL:RW')::uuid, 'PESAPAL', 'RW', true, CURRENT_TIMESTAMP)
ON CONFLICT ("provider", "country_code") DO NOTHING;
