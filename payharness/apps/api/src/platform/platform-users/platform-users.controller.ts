import { Controller, Get, UseGuards } from '@nestjs/common';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { PlatformUsersService } from './platform-users.service';

@Controller('platform/users')
@UseGuards(PlatformJwtAuthGuard)
export class PlatformUsersController {
  constructor(private readonly users: PlatformUsersService) {}

  @Get()
  list() {
    return this.users.list();
  }
}
