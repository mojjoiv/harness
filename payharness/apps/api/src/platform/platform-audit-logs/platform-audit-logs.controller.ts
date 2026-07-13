import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';

@Controller('platform/audit-logs')
@UseGuards(PlatformJwtAuthGuard, RolesGuard)
@Roles(PlatformRole.SUPERADMIN, PlatformRole.COMPLIANCE)
export class PlatformAuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.auditLogs.listAll(query);
  }
}
