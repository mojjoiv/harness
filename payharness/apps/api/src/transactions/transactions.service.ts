import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, Provider } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

interface TransactionFilters {
  status?: string;
  provider?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  list(merchantId: string, filters: TransactionFilters) {
    const where: Prisma.TransactionWhereInput = { merchantId };
    if (filters.status && Object.values(PaymentStatus).includes(filters.status as PaymentStatus)) {
      where.status = filters.status as PaymentStatus;
    }
    if (filters.provider && Object.values(Provider).includes(filters.provider as Provider)) {
      where.payment = { provider: filters.provider as Provider };
    }
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    return this.prisma.transaction.findMany({
      where,
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(merchantId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, merchantId },
      include: { payment: true },
    });
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }
}
