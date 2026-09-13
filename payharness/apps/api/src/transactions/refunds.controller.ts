import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';
import { getPagination, paginated } from '../common/pagination/pagination';

@UseGuards(JwtAuthGuard)
@Controller('refunds')
export class RefundsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query() pagination?: PaginationQueryDto,
  ) {
    const query = pagination || {};
    const page = getPagination(query, ['createdAt', 'amountCents', 'currency', 'status']);
    const where: Prisma.TransactionWhereInput = {
      merchantId: user.merchantId,
      type: 'REFUND',
    };

    if (status) where.status = status as Prisma.TransactionWhereInput['status'];
    if (provider) where.payment = { provider: provider as Prisma.TransactionWhereInput['payment'] extends { provider?: infer P } ? P : never };
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: { payment: true },
        orderBy: { [page.sort]: page.order },
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return paginated(items, total, page);
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.prisma.transaction.findFirstOrThrow({
      where: { id, merchantId: user.merchantId, type: 'REFUND' },
      include: { payment: true },
    });
  }
}
