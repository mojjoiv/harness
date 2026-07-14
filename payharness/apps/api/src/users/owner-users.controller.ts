import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateOwnerUserDto, UpdateOwnerUserDto } from './dto/owner-user.dto';
import { OwnerUsersService } from './owner-users.service';

@Controller('owner/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class OwnerUsersController {
  constructor(private readonly ownerUsers: OwnerUsersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.ownerUsers.list(user.merchantId as string);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOwnerUserDto) {
    return this.ownerUsers.create(user.merchantId as string, user.userId, user.role, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateOwnerUserDto) {
    return this.ownerUsers.update(user.merchantId as string, user.userId, user.role, id, dto);
  }

  @Patch(':id/deactivate')
  deactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ownerUsers.setStatus(user.merchantId as string, user.userId, user.role, id, 'DEACTIVATED');
  }

  @Patch(':id/reactivate')
  reactivate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ownerUsers.setStatus(user.merchantId as string, user.userId, user.role, id, 'ACTIVE');
  }

  @Patch(':id/reset-password')
  resetPassword(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ownerUsers.resetPassword(user.merchantId as string, user.userId, user.role, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ownerUsers.remove(user.merchantId as string, user.userId, user.role, id);
  }
}
