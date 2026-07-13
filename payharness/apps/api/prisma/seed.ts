import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function bootstrapSuperadmin() {
  const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME } = process.env;

  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD || !SUPERADMIN_NAME) {
    return;
  }

  const password = await bcrypt.hash(SUPERADMIN_PASSWORD, 12);
  await prisma.platformUser.upsert({
    where: { email: SUPERADMIN_EMAIL },
    update: {
      name: SUPERADMIN_NAME,
      password,
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    },
    create: {
      email: SUPERADMIN_EMAIL,
      password,
      name: SUPERADMIN_NAME,
      role: 'SUPERADMIN',
      status: 'ACTIVE',
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

  const providers: Array<'MPESA' | 'STRIPE' | 'PAYPAL'> = ['MPESA', 'STRIPE', 'PAYPAL'];
  for (const provider of providers) {
    await prisma.platformGatewayConfig.upsert({
      where: { provider },
      update: {},
      create: { provider, enabled: true },
    });
  }

  await bootstrapSuperadmin();
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
