import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PlatformMerchantsController } from './platform-merchants.controller';
import { PlatformMerchantsService } from './platform-merchants.service';

@Module({
  imports: [CommonModule],
  controllers: [PlatformMerchantsController],
  providers: [PlatformMerchantsService],
})
export class PlatformMerchantsModule {}
