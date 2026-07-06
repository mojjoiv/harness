import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  list(merchantId: string) {
    return this.prisma.customer.findMany({ where: { merchantId } });
  }
}
