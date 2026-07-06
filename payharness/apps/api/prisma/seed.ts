import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { slugify } from '../src/common/utils/slug.util';

const prisma = new PrismaClient();

async function bootstrapSuperadmin() {
  const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME, SUPERADMIN_MERCHANT_NAME } = process.env;

  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD || !SUPERADMIN_NAME || !SUPERADMIN_MERCHANT_NAME) {
    return;
  }

  const passwordHash = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {
      name: SUPERADMIN_NAME,
      passwordHash,
    },
    create: {
      email: SUPERADMIN_EMAIL,
      name: SUPERADMIN_NAME,
      passwordHash,
    },
    include: {
      merchantUsers: {
        where: { role: 'SUPERADMIN' },
        take: 1,
      },
    },
  });

  const existingMerchantId = user.merchantUsers[0]?.merchantId;
  const baseSlug = slugify(SUPERADMIN_MERCHANT_NAME) || 'platform-superadmin';
  const merchant = existingMerchantId
    ? await prisma.merchant.update({
        where: { id: existingMerchantId },
        data: {
          name: SUPERADMIN_MERCHANT_NAME,
        },
      })
    : await prisma.merchant.upsert({
        where: { slug: baseSlug },
        update: { name: SUPERADMIN_MERCHANT_NAME },
        create: {
          name: SUPERADMIN_MERCHANT_NAME,
          slug: baseSlug,
        },
      });

  await prisma.merchantUser.upsert({
    where: {
      merchantId_userId: {
        merchantId: merchant.id,
        userId: user.id,
      },
    },
    update: { role: 'SUPERADMIN' },
    create: {
      merchantId: merchant.id,
      userId: user.id,
      role: 'SUPERADMIN',
    },
  });
}

async function main() {
  const plans = [
    {
      name: 'Starter',
      code: 'STARTER',
      priceCents: 150000,
      currency: 'KES',
      features: { providers: ['MPESA'], transactionsPerMonth: 100 },
    },
    {
      name: 'Business',
      code: 'BUSINESS',
      priceCents: 450000,
      currency: 'KES',
      features: { providers: ['MPESA', 'STRIPE', 'PAYPAL'], transactionsPerMonth: 1000 },
    },
    {
      name: 'Enterprise',
      code: 'ENTERPRISE',
      priceCents: 0,
      currency: 'KES',
      features: { customPricing: true, prioritySupport: true, customLimits: true },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  await bootstrapSuperadmin();
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
