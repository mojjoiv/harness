import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CreateProviderPaymentDto } from '../payments/dto/create-provider-payment.dto';

export type FraudRiskAssessmentResult = {
  id: string;
  decision: 'ALLOW' | 'REVIEW' | 'BLOCK';
  score: number;
  reasons: string[];
};

type RiskMetadata = Record<string, unknown>;

@Injectable()
export class FraudRiskService {
  private readonly defaultWindowMinutes = 10;
  private readonly defaultReviewScore = 40;
  private readonly defaultBlockScore = 70;
  private readonly defaultHighValueCents = 1_000_000;
  private readonly defaultVeryHighValueCents = 5_000_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async assess(
    merchantId: string,
    dto: CreateProviderPaymentDto,
  ): Promise<FraudRiskAssessmentResult> {
    const now = new Date();
    const windowMinutes = this.numberConfig(
      'FRAUD_RISK_WINDOW_MINUTES',
      this.defaultWindowMinutes,
    );
    const since = new Date(now.getTime() - windowMinutes * 60_000);
    const reviewScore = this.numberConfig(
      'FRAUD_RISK_REVIEW_SCORE',
      this.defaultReviewScore,
    );
    const blockScore = this.numberConfig(
      'FRAUD_RISK_BLOCK_SCORE',
      this.defaultBlockScore,
    );
    const highValueCents = this.numberConfig(
      'FRAUD_RISK_HIGH_VALUE_CENTS',
      this.defaultHighValueCents,
    );
    const veryHighValueCents = this.numberConfig(
      'FRAUD_RISK_VERY_HIGH_VALUE_CENTS',
      this.defaultVeryHighValueCents,
    );

    const metadata = this.asMetadata(dto.metadata);
    const ipHash = this.hashSignal(this.stringSignal(metadata, ['ipAddress', 'ip']));
    const deviceHash = this.hashSignal(
      this.stringSignal(metadata, ['deviceId', 'deviceFingerprint', 'fingerprint']),
    );

    const recentPayments = await this.prisma.payment.findMany({
      where: {
        merchantId,
        createdAt: { gte: since },
      },
      select: {
        customerId: true,
        status: true,
        metadata: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const customerAttempts = dto.customerId
      ? recentPayments.filter((payment) => payment.customerId === dto.customerId).length
      : 0;
    const customerFailures = dto.customerId
      ? recentPayments.filter(
          (payment) =>
            payment.customerId === dto.customerId &&
            payment.status === PaymentStatus.FAILED,
        ).length
      : 0;

    const ipAttempts = ipHash
      ? recentPayments.filter(
          (payment) =>
            this.hashSignal(
              this.stringSignal(this.asMetadata(payment.metadata), ['ipAddress', 'ip']),
            ) === ipHash,
        ).length
      : 0;

    const deviceAttempts = deviceHash
      ? recentPayments.filter(
          (payment) =>
            this.hashSignal(
              this.stringSignal(this.asMetadata(payment.metadata), [
                'deviceId',
                'deviceFingerprint',
                'fingerprint',
              ]),
            ) === deviceHash,
        ).length
      : 0;

    let score = 0;
    const reasons: string[] = [];

    if (dto.amountCents >= veryHighValueCents) {
      score += 25;
      reasons.push('Very high transaction amount');
    } else if (dto.amountCents >= highValueCents) {
      score += 15;
      reasons.push('High transaction amount');
    }

    if (customerAttempts >= 10) {
      score += 40;
      reasons.push('Extreme customer transaction velocity');
    } else if (customerAttempts >= 5) {
      score += 25;
      reasons.push('High customer transaction velocity');
    }

    if (ipAttempts >= 10) {
      score += 40;
      reasons.push('Extreme IP transaction velocity');
    } else if (ipAttempts >= 5) {
      score += 25;
      reasons.push('High IP transaction velocity');
    }

    if (deviceAttempts >= 10) {
      score += 30;
      reasons.push('Extreme device transaction velocity');
    } else if (deviceAttempts >= 5) {
      score += 20;
      reasons.push('High device transaction velocity');
    }

    if (customerFailures >= 3) {
      score += 15;
      reasons.push('Repeated recent customer payment failures');
    }

    if (!dto.customerId && dto.amountCents >= highValueCents) {
      score += 10;
      reasons.push('High-value payment without a customer identity');
    }

    score = Math.min(100, score);
    const decision =
      score >= blockScore ? 'BLOCK' : score >= reviewScore ? 'REVIEW' : 'ALLOW';

    const assessment = await this.prisma.fraudRiskAssessment.create({
      data: {
        merchantId,
        decision,
        score,
        reasons: reasons as Prisma.InputJsonValue,
        signals: {
          windowMinutes,
          customerAttempts,
          customerFailures,
          ipAttempts,
          deviceAttempts,
          hasCustomerId: Boolean(dto.customerId),
          provider: dto['provider'] ?? undefined,
          environment: dto.environment,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      id: assessment.id,
      decision,
      score,
      reasons,
    };
  }

  async attachPayment(assessmentId: string, paymentId: string): Promise<void> {
    await this.prisma.fraudRiskAssessment.update({
      where: { id: assessmentId },
      data: { paymentId },
    });
  }

  async listAssessments(merchantId: string) {
    return this.prisma.fraudRiskAssessment.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        paymentId: true,
        decision: true,
        score: true,
        reasons: true,
        signals: true,
        createdAt: true,
      },
    });
  }

  private numberConfig(key: string, fallback: number): number {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private asMetadata(value: unknown): RiskMetadata {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return value as RiskMetadata;
  }

  private stringSignal(metadata: RiskMetadata, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  }

  private hashSignal(value?: string): string | undefined {
    if (!value) return undefined;
    return createHash('sha256').update(value).digest('hex');
  }
}
