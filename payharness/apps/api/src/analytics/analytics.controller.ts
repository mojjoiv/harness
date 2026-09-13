import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdvancedReportDto } from './advanced-report.dto';
import { AnalyticsQueryDto } from './analytics-query.dto';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('advanced')
  advanced(@CurrentUser() user: AuthUser, @Query() query: AdvancedReportDto) {
    return this.analyticsService.advancedReport(user.merchantId, query);
  }

  @Get('revenue')
  revenue(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.revenue(user.merchantId, query);
  }

  @Get('providers')
  providers(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.providers(user.merchantId, query);
  }

  @Get('payments')
  payments(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.payments(user.merchantId, query);
  }
}
