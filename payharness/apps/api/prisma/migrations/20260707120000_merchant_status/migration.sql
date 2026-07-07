-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- AlterTable
ALTER TABLE "merchants" ADD COLUMN "status" "MerchantStatus" NOT NULL DEFAULT 'PENDING';
