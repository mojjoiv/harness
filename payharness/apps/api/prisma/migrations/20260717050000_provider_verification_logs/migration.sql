-- CreateTable
CREATE TABLE "provider_verification_logs" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "environment" "Environment" NOT NULL,
    "success" BOOLEAN NOT NULL,
    "response_time_ms" INTEGER,
    "http_status" INTEGER,
    "oauth_succeeded" BOOLEAN,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_verification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_verification_logs_credential_id_created_at_idx" ON "provider_verification_logs"("credential_id", "created_at");

-- AddForeignKey
ALTER TABLE "provider_verification_logs" ADD CONSTRAINT "provider_verification_logs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
