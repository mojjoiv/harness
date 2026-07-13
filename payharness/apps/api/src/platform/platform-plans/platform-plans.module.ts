import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { CommonModule } from '../../common/common.module';
import { PlatformPlansController } from './platform-plans.controller';
import { PlatformPlansService } from './platform-plans.service';

@Module({
  imports: [CommonModule, AuditLogsModule],
  controllers: [PlatformPlansController],
  providers: [PlatformPlansService],
})
export class PlatformPlansModule {}
