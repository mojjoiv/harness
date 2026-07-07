import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { MerchantsService } from './merchants.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('merchants')
export class MerchantsController {
  constructor(private readonly merchantsService: MerchantsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.merchantsService.getMerchant(user.merchantId);
  }

  @Patch('me')
  @Roles(UserRole.OWNER)
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMerchantDto) {
    return this.merchantsService.updateMerchant(user.merchantId, dto);
  }
}
