import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PlatformPlansController } from './platform-plans.controller';
import { PlatformPlansService } from './platform-plans.service';

@Module({
  imports: [CommonModule],
  controllers: [PlatformPlansController],
  providers: [PlatformPlansService],
})
export class PlatformPlansModule {}
