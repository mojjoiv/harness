import { FraudRiskService } from './fraud-risk.service';

describe('FraudRiskService', () => {
  const prisma = {
    payment: { findMany: jest.fn() },
    fraudRiskAssessment: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
  const config = { get: jest.fn() } as any;
  let service: FraudRiskService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockReturnValue(undefined);
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.fraudRiskAssessment.create.mockResolvedValue({ id: 'assessment-1' });
    prisma.fraudRiskAssessment.update.mockResolvedValue({});
    prisma.fraudRiskAssessment.findMany.mockResolvedValue([]);
    service = new FraudRiskService(prisma, config);
  });

  it('allows normal low-velocity payments', async () => {
    await expect(
      service.assess('merchant-1', {
        amountCents: 1000,
        currency: 'KES',
        environment: 'SANDBOX',
        customerId: 'customer-1',
      } as any),
    ).resolves.toEqual({
      id: 'assessment-1',
      decision: 'ALLOW',
      score: 0,
      reasons: [],
    });
  });

  it('flags repeated customer failures for review', async () => {
    prisma.payment.findMany.mockResolvedValue(
      Array.from({ length: 3 }, () => ({
        customerId: 'customer-1',
        status: 'FAILED',
        metadata: {},
      })),
    );

    await expect(
      service.assess('merchant-1', {
        amountCents: 1000,
        currency: 'KES',
        environment: 'SANDBOX',
        customerId: 'customer-1',
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        decision: 'REVIEW',
        score: 15,
        reasons: ['Repeated recent customer payment failures'],
      }),
    );
  });

  it('blocks extreme velocity', async () => {
    prisma.payment.findMany.mockResolvedValue(
      Array.from({ length: 10 }, () => ({
        customerId: 'customer-1',
        status: 'PENDING',
        metadata: { ipAddress: '203.0.113.10' },
      })),
    );

    await expect(
      service.assess('merchant-1', {
        amountCents: 1000,
        currency: 'KES',
        environment: 'SANDBOX',
        customerId: 'customer-1',
        metadata: { ipAddress: '203.0.113.10' },
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        decision: 'BLOCK',
        score: 80,
      }),
    );
  });

  it('hashes assessment signals instead of persisting raw identifiers', async () => {
    await service.assess('merchant-1', {
      amountCents: 1000,
      currency: 'KES',
      environment: 'SANDBOX',
      metadata: {
        ipAddress: '203.0.113.10',
        deviceId: 'device-secret',
      },
    } as any);

    expect(prisma.fraudRiskAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signals: expect.not.objectContaining({
            ipAddress: '203.0.113.10',
            deviceId: 'device-secret',
          }),
        }),
      }),
    );
  });
});
