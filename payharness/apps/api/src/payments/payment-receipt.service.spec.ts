import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentReceiptService } from './payment-receipt.service';

const receipt = {
  id: 'receipt-1',
  merchantId: 'merchant-1',
  paymentId: 'payment-1',
  receiptNumber: 'RCP-20260911-ABC1234567',
  amountCents: 2500,
  currency: 'KES',
  provider: 'MPESA',
  providerReference: 'ws_CO_123',
  paymentStatus: 'SUCCEEDED',
  customerId: 'customer-1',
  customerName: 'Jane Doe',
  customerEmail: 'jane@example.com',
  customerPhone: '254700000000',
  issuedAt: new Date('2026-09-11T08:00:00.000Z'),
};

describe('PaymentReceiptService', () => {
  let service: PaymentReceiptService;
  let prisma: {
    payment: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      payment: { findFirst: jest.fn() },
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
    };
    service = new PaymentReceiptService(prisma as never);
  });

  it('returns an existing receipt without creating another one', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      status: 'SUCCEEDED',
    });
    prisma.$queryRaw.mockResolvedValue([receipt]);

    await expect(service.getReceipt('merchant-1', 'payment-1')).resolves.toEqual(receipt);
    expect(prisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('rejects receipts for payments that are not succeeded', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      status: 'PENDING',
    });

    await expect(service.getReceipt('merchant-1', 'payment-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects access to a payment belonging to another merchant', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(service.getReceipt('merchant-2', 'payment-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a receipt when a succeeded payment has no receipt yet', async () => {
    prisma.payment.findFirst
      .mockResolvedValueOnce({ id: 'payment-1', status: 'SUCCEEDED' })
      .mockResolvedValueOnce({ status: 'SUCCEEDED' });
    prisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receipt]);
    prisma.$executeRaw.mockResolvedValue(1);

    await expect(service.getReceipt('merchant-1', 'payment-1')).resolves.toEqual(receipt);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('returns the existing receipt when concurrent generation hits a unique constraint', async () => {
    prisma.payment.findFirst
      .mockResolvedValueOnce({ id: 'payment-1', status: 'SUCCEEDED' })
      .mockResolvedValueOnce({ status: 'SUCCEEDED' });
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([receipt]);
    prisma.$executeRaw.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.22.0',
      }),
    );

    await expect(service.getReceipt('merchant-1', 'payment-1')).resolves.toEqual(receipt);
  });
});
