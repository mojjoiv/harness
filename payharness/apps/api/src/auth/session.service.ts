import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../common/prisma.service';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(input: {
    userId?: string;
    platformUserId?: string;
    merchantId?: string;
  }) {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        platformUserId: input.platformUserId,
        merchantId: input.merchantId,
        refreshTokenHash: this.hash(refreshToken),
        familyId: randomBytes(24).toString('hex'),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });
    return { session, refreshToken };
  }

  async rotate(refreshToken: string) {
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.hash(refreshToken) },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const next = await this.prisma.session.create({
      data: {
        userId: session.userId,
        platformUserId: session.platformUserId,
        merchantId: session.merchantId,
        refreshTokenHash: this.hash(nextToken),
        familyId: session.familyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), replacedBySessionId: next.id },
    });

    return { session: next, refreshToken: nextToken };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForPlatformUser(platformUserId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { platformUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
