import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { CommonModule } from '../../common/common.module';
import { PlatformAuditLogsController } from './platform-audit-logs.controller';

@Module({
  imports: [CommonModule, AuditLogsModule],
  controllers: [PlatformAuditLogsController],
})
export class PlatformAuditLogsModule {}
