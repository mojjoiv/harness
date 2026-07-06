import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateMerchantProfileDto } from './dto/update-merchant-profile.dto';
import { MerchantProfileService } from './merchant-profile.service';

@UseGuards(JwtAuthGuard)
@Controller('merchant/profile')
export class MerchantProfileController {
  constructor(private readonly profileService: MerchantProfileService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.profileService.get(user.merchantId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMerchantProfileDto) {
    return this.profileService.update(user.merchantId, user.userId, dto);
  }
}
