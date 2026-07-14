-- CreateTable
CREATE TABLE "provider_country_availability" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "country_code" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_country_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "provider_country_availability_provider_country_code_key" ON "provider_country_availability"("provider", "country_code");
