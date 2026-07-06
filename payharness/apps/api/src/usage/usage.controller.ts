import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsageQueryDto } from './usage-query.dto';
import { UsageService } from './usage.service';

@UseGuards(JwtAuthGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: UsageQueryDto) {
    return this.usageService.list(user.merchantId, query);
  }
}
