import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async create(merchantId: string, dto: CreateApiKeyDto) {
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

    return {
      id: apiKey.id,
      name: apiKey.name,
      environment: apiKey.environment,
      prefix: apiKey.prefix,
      status: apiKey.status,
      secret,
      createdAt: apiKey.createdAt,
    };
  }

  async list(merchantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return keys.map(({ keyHash: _keyHash, ...key }) => key);
  }

  async revoke(merchantId: string, id: string) {
    const existing = await this.prisma.apiKey.findFirst({ where: { id, merchantId } });
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    const { keyHash: _keyHash, ...apiKey } = await this.prisma.apiKey.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return apiKey;
  }
}
