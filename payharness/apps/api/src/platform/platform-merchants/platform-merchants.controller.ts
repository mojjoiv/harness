import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformMerchantsService } from './platform-merchants.service';

@Controller('platform/merchants')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformMerchantsController {
  constructor(private readonly merchants: PlatformMerchantsService) {}

  @Get()
  list() {
    return this.merchants.list();
  }
}
