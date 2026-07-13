import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlatformRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PlatformJwtAuthGuard } from '../common/platform-jwt-auth.guard';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PlatformPlansService } from './platform-plans.service';

@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard, RolesGuard)
export class PlatformPlansController {
  constructor(private readonly plans: PlatformPlansService) {}

  @Get()
  list() {
    return this.plans.list();
  }

  @Post()
  @Roles(PlatformRole.SUPERADMIN)
  create(@Body() dto: CreatePlanDto, @CurrentUser() user: AuthUser) {
    return this.plans.create(dto, user.userId);
  }

  @Patch(':id')
  @Roles(PlatformRole.SUPERADMIN)
  update(@Param('id') id: string, @Body() dto: UpdatePlanDto, @CurrentUser() user: AuthUser) {
    return this.plans.update(id, dto, user.userId);
  }

  @Patch(':id/suspend')
  @Roles(PlatformRole.SUPERADMIN)
  suspend(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.plans.suspend(id, user.userId);
  }

  @Patch(':id/reactivate')
  @Roles(PlatformRole.SUPERADMIN)
  reactivate(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.plans.reactivate(id, user.userId);
  }

  @Delete(':id')
  @Roles(PlatformRole.SUPERADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.plans.remove(id, user.userId);
  }
}
