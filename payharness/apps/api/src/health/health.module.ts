import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RootController } from './root.controller';
import { StatusController } from './status.controller';

@Module({
  controllers: [HealthController, RootController, StatusController],
})
export class HealthModule {}
