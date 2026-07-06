import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateMerchantSettingsDto } from './dto/update-merchant-settings.dto';
import { MerchantSettingsService } from './merchant-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('merchant/settings')
export class MerchantSettingsController {
  constructor(private readonly settingsService: MerchantSettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settingsService.get(user.merchantId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMerchantSettingsDto) {
    return this.settingsService.update(user.merchantId, user.userId, dto);
  }
}
