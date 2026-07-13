import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module';
import { PlatformOwnersController } from './platform-owners.controller';
import { PlatformOwnersService } from './platform-owners.service';

@Module({
  imports: [CommonModule],
  controllers: [PlatformOwnersController],
  providers: [PlatformOwnersService],
})
export class PlatformOwnersModule {}
