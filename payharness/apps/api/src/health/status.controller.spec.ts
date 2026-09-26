import { StatusController } from './status.controller';

describe('StatusController', () => {
  it('reports operational status when the database is reachable', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]) };
    const controller = new StatusController(prisma as never);

    await expect(controller.status()).resolves.toMatchObject({
      status: 'operational',
      components: {
        api: 'operational',
        database: 'operational',
      },
    });
  });

  it('reports degraded status when the database is unavailable', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('database down')) };
    const controller = new StatusController(prisma as never);

    await expect(controller.status()).resolves.toMatchObject({
      status: 'degraded',
      components: {
        api: 'operational',
        database: 'degraded',
      },
    });
  });
});
