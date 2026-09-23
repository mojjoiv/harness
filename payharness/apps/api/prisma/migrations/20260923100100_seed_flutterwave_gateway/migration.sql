INSERT INTO "platform_gateway_configs" ("id", "provider", "enabled", "updated_at")
VALUES (md5('FLUTTERWAVE')::uuid, 'FLUTTERWAVE', true, CURRENT_TIMESTAMP)
ON CONFLICT ("provider") DO NOTHING;

INSERT INTO "provider_country_availability" ("id", "provider", "country_code", "enabled", "updated_at")
VALUES
  (md5('FLUTTERWAVE:KE')::uuid, 'FLUTTERWAVE', 'KE', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:NG')::uuid, 'FLUTTERWAVE', 'NG', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:GH')::uuid, 'FLUTTERWAVE', 'GH', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:UG')::uuid, 'FLUTTERWAVE', 'UG', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:TZ')::uuid, 'FLUTTERWAVE', 'TZ', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:RW')::uuid, 'FLUTTERWAVE', 'RW', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:ZA')::uuid, 'FLUTTERWAVE', 'ZA', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:ZM')::uuid, 'FLUTTERWAVE', 'ZM', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:MW')::uuid, 'FLUTTERWAVE', 'MW', true, CURRENT_TIMESTAMP),
  (md5('FLUTTERWAVE:EG')::uuid, 'FLUTTERWAVE', 'EG', true, CURRENT_TIMESTAMP)
ON CONFLICT ("provider", "country_code") DO NOTHING;
