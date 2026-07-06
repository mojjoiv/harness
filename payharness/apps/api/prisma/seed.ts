import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
