import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Controller('status')
export class StatusController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async status() {
    let database: 'operational' | 'degraded' = 'operational';

    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      database = 'degraded';
    }

    const overall = database === 'operational' ? 'operational' : 'degraded';

    return {
      status: overall,
      updatedAt: new Date().toISOString(),
      components: {
        api: 'operational',
        database,
      },
      supportedProviders: ['MPESA', 'STRIPE', 'PAYPAL', 'PESAPAL', 'FLUTTERWAVE'],
      note: 'Provider availability can depend on merchant configuration, provider account status, country, and external provider systems.',
    };
  }
}
