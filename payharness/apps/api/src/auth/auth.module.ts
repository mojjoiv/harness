import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CommonModule } from '../common/common.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

@Module({
  imports: [CommonModule, AuditLogsModule],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
