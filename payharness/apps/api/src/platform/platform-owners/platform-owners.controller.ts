import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformOwnersService } from './platform-owners.service';

@Controller('platform/owners')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformOwnersController {
  constructor(private readonly owners: PlatformOwnersService) {}

  @Get()
  list() {
    return this.owners.list();
  }
}
