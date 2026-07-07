import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateMerchantBrandingDto } from './dto/update-merchant-branding.dto';
import { MerchantBrandingService } from './merchant-branding.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchant/branding')
export class MerchantBrandingController {
  constructor(private readonly brandingService: MerchantBrandingService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.brandingService.get(user.merchantId);
  }

  @Patch()
  @Roles(UserRole.OWNER)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMerchantBrandingDto) {
    return this.brandingService.update(user.merchantId, user.userId, dto);
  }
}
