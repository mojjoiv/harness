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

    const secret = `ph_${dto.environment.toLowerCase()}_${randomBytes(24).toString('hex')}`;
    const prefix = secret.slice(0, 16);
    const keyHash = await bcrypt.hash(secret, 12);
    const apiKey = await this.prisma.apiKey.create({
      data: {
        merchantId,
        name: dto.name,
        environment: dto.environment,
        prefix,
        keyHash,
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

  async list(merchantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(({ keyHash: _keyHash, ...key }) => ({
      ...key,
      maskedKey: `${key.prefix}...`,
    }));
  }

  async revoke(merchantId: string, userId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, merchantId } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    const { keyHash: _keyHash, ...apiKey } = await this.prisma.apiKey.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'api_key.revoked',
      entity: 'api_key',
      entityId: id,
    });
    return { ...apiKey, maskedKey: `${apiKey.prefix}...` };
  }
}
