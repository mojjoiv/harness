-- CreateEnum
CREATE TYPE "MerchantUserStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "merchant_users" ADD COLUMN "status" "MerchantUserStatus" NOT NULL DEFAULT 'ACTIVE';
