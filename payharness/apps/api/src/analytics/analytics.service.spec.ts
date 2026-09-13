import { BadRequestException } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService advanced reporting', () => {
  const queryRaw = jest.fn();
  const service = new AnalyticsService({ $queryRaw: queryRaw } as any);

  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('returns unified payment, refund, and payout analytics', async () => {
    queryRaw.mockResolvedValue([
      {
        current_summary: {
          paymentCount: 10,
          grossVolumeCents: 100000,
          successfulCount: 8,
          successfulVolumeCents: 80000,
          failedCount: 2,
          failedVolumeCents: 20000,
          refundCount: 1,
          refundedVolumeCents: 5000,
          payoutCount: 2,
          payoutVolumeCents: 10000,
        },
        current_providers: [
          {
            provider: 'MPESA',
            paymentCount: 6,
            grossVolumeCents: 60000,
            successfulCount: 5,
            failedCount: 1,
            successRate: 83.33,
          },
        ],
        current_currencies: [
          {
            currency: 'KES',
            grossVolumeCents: 100000,
            refundedVolumeCents: 5000,
            payoutVolumeCents: 10000,
          },
        ],
        current_daily: [
          {
            date: '2026-09-13',
            grossVolumeCents: 100000,
            refundedVolumeCents: 5000,
            payoutVolumeCents: 10000,
          },
        ],
        previous_summary: {
          paymentCount: 5,
          grossVolumeCents: 50000,
          successfulCount: 4,
          successfulVolumeCents: 40000,
          failedCount: 1,
          failedVolumeCents: 10000,
          refundCount: 0,
          refundedVolumeCents: 0,
          payoutCount: 1,
          payoutVolumeCents: 5000,
        },
      },
    ]);

    const result = await service.advancedReport('merchant-1', {
      startDate: '2026-09-01',
      endDate: '2026-09-13',
      compare: 'true',
    });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result.summary).toMatchObject({
      paymentCount: 10,
      grossVolumeCents: 100000,
      successfulCount: 8,
      refundCount: 1,
      payoutCount: 2,
      netVolumeCents: 85000,
      successRate: 80,
    });
    expect(result.byProvider[0].provider).toBe('MPESA');
    expect(result.byCurrency[0].netVolumeCents).toBe(85000);
    expect(result.daily[0].netVolumeCents).toBe(85000);
    expect(result.comparison?.changes.grossVolumePct).toBe(100);
    expect(result.comparison?.changes.successRatePoints).toBe(0);
  });

  it('rejects an invalid date range', async () => {
    await expect(
      service.advancedReport('merchant-1', {
        startDate: '2026-09-14',
        endDate: '2026-09-13',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
