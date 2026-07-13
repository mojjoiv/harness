import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../../audit-logs/audit-logs.module';
import { CommonModule } from '../../common/common.module';
import { PlatformGatewaysController } from './platform-gateways.controller';
import { PlatformGatewaysService } from './platform-gateways.service';

@Module({
  imports: [CommonModule, AuditLogsModule],
  controllers: [PlatformGatewaysController],
  providers: [PlatformGatewaysService],
  exports: [PlatformGatewaysService],
})
export class PlatformGatewaysModule {}
