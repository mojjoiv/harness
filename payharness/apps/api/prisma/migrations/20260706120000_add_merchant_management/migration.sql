CREATE TABLE "merchant_profiles" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "business_name" TEXT,
  "legal_name" TEXT,
  "registration_number" TEXT,
  "tax_pin" TEXT,
  "country" TEXT,
  "currency" TEXT,
  "timezone" TEXT,
  "support_email" TEXT,
  "support_phone" TEXT,
  "website" TEXT,
  "logo_url" TEXT,
  "primary_brand_color" TEXT,
  "secondary_brand_color" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "merchant_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_branding" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "logo_url" TEXT,
  "favicon_url" TEXT,
  "primary_color" TEXT NOT NULL DEFAULT '#2563eb',
  "secondary_color" TEXT NOT NULL DEFAULT '#0f172a',
  "button_color" TEXT NOT NULL DEFAULT '#2563eb',
  "success_page_message" TEXT,
  "cancel_page_message" TEXT,
  "receipt_footer" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "merchant_branding_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "merchant_settings" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "default_currency" TEXT NOT NULL DEFAULT 'KES',
  "default_environment" "Environment" NOT NULL DEFAULT 'SANDBOX',
  "receipt_emails_enabled" BOOLEAN NOT NULL DEFAULT true,
  "webhook_retries_enabled" BOOLEAN NOT NULL DEFAULT true,
  "retry_count" INTEGER NOT NULL DEFAULT 3,
  "payment_timeout_minutes" INTEGER NOT NULL DEFAULT 30,
  "require_customer_email" BOOLEAN NOT NULL DEFAULT false,
  "require_customer_phone" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "merchant_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "api_usage" (
  "id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "api_key_id" TEXT,
  "endpoint" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "response_time_ms" INTEGER NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "merchant_profiles_merchant_id_key" ON "merchant_profiles"("merchant_id");
CREATE UNIQUE INDEX "merchant_branding_merchant_id_key" ON "merchant_branding"("merchant_id");
CREATE UNIQUE INDEX "merchant_settings_merchant_id_key" ON "merchant_settings"("merchant_id");
CREATE INDEX "api_usage_merchant_id_created_at_idx" ON "api_usage"("merchant_id", "created_at");

ALTER TABLE "merchant_profiles"
  ADD CONSTRAINT "merchant_profiles_merchant_id_fkey"
  FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "merchant_branding"
  ADD CONSTRAINT "merchant_branding_merchant_id_fkey"
  FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "merchant_settings"
  ADD CONSTRAINT "merchant_settings_merchant_id_fkey"
  FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_usage"
  ADD CONSTRAINT "api_usage_merchant_id_fkey"
  FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_usage"
  ADD CONSTRAINT "api_usage_api_key_id_fkey"
  FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;
