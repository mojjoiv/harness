import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, Provider } from '@prisma/client';
import { DisplayCurrencyService } from '../common/currency/display-currency.service';
import { PrismaService } from '../common/prisma.service';
import { currencyForCountry } from '../common/utils/country-currency.util';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { getPagination, paginated } from '../common/pagination/pagination';

interface TransactionFilters {
  status?: string;
  provider?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly displayCurrency: DisplayCurrencyService,
  ) {}

  async list(merchantId: string, filters: TransactionFilters, query: PaginationQueryDto) {
    const pagination = getPagination(query, ['createdAt', 'amountCents', 'currency', 'status', 'type']);
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

    const [items, total, profile] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { payment: true },
        orderBy: { [pagination.sort]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.transaction.count({ where }),
      this.prisma.merchantProfile.findUnique({
        where: { merchantId },
        select: { country: true, currency: true },
      }),
    ]);

    const displayCurrency = profile?.currency?.trim().toUpperCase() || currencyForCountry(profile?.country);
    const data = await Promise.all(
      items.map(async ({ payment, ...transaction }) => {
        const conversion = await this.displayCurrency.convertAmount(
          transaction.amountCents,
          transaction.currency,
          displayCurrency,
        );
        return {
          ...transaction,
          provider: payment?.provider,
          payment,
          displayAmountCents: conversion.displayAmountCents,
          displayCurrency: conversion.displayCurrency,
          displayExchangeRate: conversion.exchangeRate,
          displayRateTimestamp: conversion.rateTimestamp,
        };
      }),
    );

    return paginated(data, total, pagination);
  }

  async get(merchantId: string, id: string) {
    const [transaction, profile] = await Promise.all([
      this.prisma.transaction.findFirst({
        where: { id, merchantId },
        include: { payment: true },
      }),
      this.prisma.merchantProfile.findUnique({
        where: { merchantId },
        select: { country: true, currency: true },
      }),
    ]);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const displayCurrency = profile?.currency?.trim().toUpperCase() || currencyForCountry(profile?.country);
    const conversion = await this.displayCurrency.convertAmount(
      transaction.amountCents,
      transaction.currency,
      displayCurrency,
    );
    const { payment, ...transactionData } = transaction;
    return {
      ...transactionData,
      provider: payment?.provider,
      payment,
      displayAmountCents: conversion.displayAmountCents,
      displayCurrency: conversion.displayCurrency,
      displayExchangeRate: conversion.exchangeRate,
      displayRateTimestamp: conversion.rateTimestamp,
    };
  }
}
