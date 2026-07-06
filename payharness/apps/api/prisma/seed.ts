import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.subscriptionPlan.upsert({
    where: { code: 'starter' },
    update: {},
    create: {
      name: 'Starter',
      code: 'starter',
      priceCents: 0,
      currency: 'USD',
      features: { apiKeys: 2, providers: ['MPESA', 'STRIPE', 'PAYPAL'] },
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
