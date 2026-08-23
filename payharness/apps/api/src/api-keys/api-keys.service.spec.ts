import { ConflictException, NotFoundException } from '@nestjs/common';
import { Environment, Status } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ApiKeysService } from './api-keys.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
}));

describe('ApiKeysService', () => {
  const prisma = {
    apiKey: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };
  const auditLogs = {
    create: jest.fn(),
  };
  const service = new ApiKeysService(prisma as never, auditLogs as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('rejects duplicate active key names and records the failed attempt', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({ id: 'existing-key' });

      await expect(
        service.create('merchant-1', 'user-1', {
          name: 'Production',
          environment: Environment.LIVE,
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(auditLogs.create).toHaveBeenCalledWith({
        merchantId: 'merchant-1',
        userId: 'user-1',
        action: 'api_key.create_failed',
        entity: 'api_key',
        metadata: { reason: 'duplicate_name', name: 'Production' },
      });
      expect(prisma.apiKey.create).not.toHaveBeenCalled();
    });

    it('creates a key, hashes the secret, and returns the secret once', async () => {
      const createdAt = new Date('2026-08-23T00:00:00.000Z');
      prisma.apiKey.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-secret');
      prisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        name: 'Sandbox',
        environment: Environment.SANDBOX,
        prefix: 'ph_sandbox_123',
        keyHash: 'hashed-secret',
        status: Status.ACTIVE,
        createdAt,
      });

      const result = await service.create('merchant-1', 'user-1', {
        name: 'Sandbox',
        environment: Environment.SANDBOX,
      });

      expect(result).toMatchObject({
        id: 'key-1',
        name: 'Sandbox',
        environment: Environment.SANDBOX,
        status: Status.ACTIVE,
        createdAt,
      });
      expect(result.apiKey).toMatch(/^ph_sandbox_[0-9a-f]{48}$/);
      expect(result.prefix).toBe(result.apiKey.slice(0, 16));
      expect(bcrypt.hash).toHaveBeenCalledWith(result.apiKey, 12);
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: {
          merchantId: 'merchant-1',
          name: 'Sandbox',
          environment: Environment.SANDBOX,
          prefix: result.prefix,
          keyHash: 'hashed-secret',
        },
      });
      expect(auditLogs.create).toHaveBeenCalledWith({
        merchantId: 'merchant-1',
        userId: 'user-1',
        action: 'api_key.created',
        entity: 'api_key',
        entityId: 'key-1',
        metadata: { environment: Environment.SANDBOX },
      });
    });
  });

  describe('list', () => {
    it('never exposes the stored hash and returns a masked key', async () => {
      prisma.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'Production',
          prefix: 'ph_live_abcdef',
          keyHash: 'secret-hash',
          environment: Environment.LIVE,
          status: Status.ACTIVE,
        },
      ]);

      const result = await service.list('merchant-1');

      expect(result).toEqual([
        expect.objectContaining({
          id: 'key-1',
          maskedKey: 'ph_live_abcdef...',
        }),
      ]);
      expect(result[0]).not.toHaveProperty('keyHash');
      expect(prisma.apiKey.findMany).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('revoke', () => {
    it('throws when the key does not belong to the merchant', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);

      await expect(service.revoke('merchant-1', 'user-1', 'key-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('revokes the key, masks it, and records the audit event', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', merchantId: 'merchant-1' });
      prisma.apiKey.update.mockResolvedValue({
        id: 'key-1',
        merchantId: 'merchant-1',
        name: 'Production',
        prefix: 'ph_live_abcdef',
        environment: Environment.LIVE,
        status: Status.REVOKED,
        keyHash: 'secret-hash',
        revokedAt: new Date('2026-08-23T00:00:00.000Z'),
      });

      const result = await service.revoke('merchant-1', 'user-1', 'key-1');

      expect(result).toMatchObject({
        id: 'key-1',
        status: Status.REVOKED,
        maskedKey: 'ph_live_abcdef...',
      });
      expect(result).not.toHaveProperty('keyHash');
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { status: 'REVOKED', revokedAt: expect.any(Date) },
      });
      expect(auditLogs.create).toHaveBeenCalledWith({
        merchantId: 'merchant-1',
        userId: 'user-1',
        action: 'api_key.revoked',
        entity: 'api_key',
        entityId: 'key-1',
      });
    });
  });
});
