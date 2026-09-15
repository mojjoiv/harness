import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(merchantId: string, userId: string, dto: CreateApiKeyDto) {
    const duplicate = await this.prisma.apiKey.findFirst({
      where: { merchantId, name: dto.name, status: 'ACTIVE' },
    });
    if (duplicate) {
      await this.auditLogs.create({
        merchantId,
        userId,
        action: 'api_key.create_failed',
        entity: 'api_key',
        metadata: { reason: 'duplicate_name', name: dto.name },
      });
      throw new ConflictException(`You already have an active API key named "${dto.name}"`);
    }

    const secret = this.generateSecret(dto.environment);
    const apiKey = await this.prisma.apiKey.create({
      data: {
        merchantId,
        name: dto.name,
        environment: dto.environment,
        prefix: secret.slice(0, 16),
        keyHash: await bcrypt.hash(secret, 12),
      },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'api_key.created',
      entity: 'api_key',
      entityId: apiKey.id,
      metadata: { environment: apiKey.environment },
    });

    return this.presentCreatedKey(apiKey, secret);
  }

  async list(merchantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(({ keyHash: _keyHash, ...key }) => {
      void _keyHash;
      return {
        ...key,
        maskedKey: `${key.prefix}...`,
      };
    });
  }

  async revoke(merchantId: string, userId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, merchantId },
    });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    const { keyHash: _keyHash, ...apiKey } = await this.prisma.apiKey.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    void _keyHash;
    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'api_key.revoked',
      entity: 'api_key',
      entityId: id,
    });
    return { ...apiKey, maskedKey: `${apiKey.prefix}...` };
  }

  async rotate(merchantId: string, userId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id, merchantId },
    });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (existing.status !== 'ACTIVE') {
      throw new ConflictException('Only an active API key can be rotated');
    }

    const secret = this.generateSecret(existing.environment);
    const keyHash = await bcrypt.hash(secret, 12);
    const now = new Date();
    const rotated = await this.prisma.$transaction(async (tx) => {
      await tx.apiKey.update({
        where: { id },
        data: { status: 'REVOKED', revokedAt: now },
      });
      return tx.apiKey.create({
        data: {
          merchantId,
          name: existing.name,
          environment: existing.environment,
          prefix: secret.slice(0, 16),
          keyHash,
        },
      });
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'api_key.rotated',
      entity: 'api_key',
      entityId: rotated.id,
      metadata: {
        environment: rotated.environment,
        replacedKeyId: id,
      },
    });

    return this.presentCreatedKey(rotated, secret);
  }

  private generateSecret(environment: CreateApiKeyDto['environment']) {
    return `ph_${environment.toLowerCase()}_${randomBytes(24).toString('hex')}`;
  }

  private presentCreatedKey(apiKey: {
    id: string;
    name: string;
    environment: CreateApiKeyDto['environment'];
    prefix: string;
    status: string;
    createdAt: Date;
  }, secret: string) {
    return {
      id: apiKey.id,
      name: apiKey.name,
      environment: apiKey.environment,
      prefix: apiKey.prefix,
      status: apiKey.status,
      apiKey: secret,
      createdAt: apiKey.createdAt,
    };
  }
}
