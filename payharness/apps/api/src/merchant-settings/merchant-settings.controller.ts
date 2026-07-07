import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateMerchantSettingsDto } from './dto/update-merchant-settings.dto';
import { MerchantSettingsService } from './merchant-settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchant/settings')
export class MerchantSettingsController {
  constructor(private readonly settingsService: MerchantSettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.settingsService.get(user.merchantId);
  }

  @Patch()
  @Roles(UserRole.OWNER)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMerchantSettingsDto) {
    return this.settingsService.update(user.merchantId, user.userId, dto);
  }
}
