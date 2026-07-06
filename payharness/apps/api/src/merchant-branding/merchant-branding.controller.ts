import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateMerchantBrandingDto } from './dto/update-merchant-branding.dto';
import { MerchantBrandingService } from './merchant-branding.service';

@UseGuards(JwtAuthGuard)
@Controller('merchant/branding')
export class MerchantBrandingController {
  constructor(private readonly brandingService: MerchantBrandingService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.brandingService.get(user.merchantId);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMerchantBrandingDto) {
    return this.brandingService.update(user.merchantId, user.userId, dto);
  }
}
