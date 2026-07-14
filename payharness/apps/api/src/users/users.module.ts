import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { OwnerUsersController } from './owner-users.controller';
import { OwnerUsersService } from './owner-users.service';
import { UsersService } from './users.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [OwnerUsersController],
  providers: [UsersService, OwnerUsersService],
  exports: [UsersService],
})
export class UsersModule {}
