import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { Provider, PlatformRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PlatformJwtAuthGuard } from '../platform/common/platform-jwt-auth.guard';
import { ProviderAvailabilityService } from './provider-availability.service';

@Controller('provider-availability')
export class ProviderAvailabilityController {
  constructor(private readonly availability: ProviderAvailabilityService) {}

  /**
   * Public and unauthenticated on purpose -- this needs to be callable from
   * the signup page, before an account exists.
   */
  @Get()
  forCountry(@Query('country') country: string) {
    if (!country) {
      return [];
    }
    return this.availability.forCountry(country);
  }

  @Get('matrix')
  @UseGuards(PlatformJwtAuthGuard)
  matrix() {
    return this.availability.matrix();
  }

  @Patch(':provider/:countryCode/toggle')
  @UseGuards(PlatformJwtAuthGuard, RolesGuard)
  @Roles(PlatformRole.SUPERADMIN)
  toggle(
    @Param('provider') provider: Provider,
    @Param('countryCode') countryCode: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.availability.toggle(provider, countryCode, user.userId);
  }
}
