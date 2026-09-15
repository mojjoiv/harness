import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { canManageApiKeys } from '../common/authz/roles';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeysService } from './api-keys.service';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    this.assertCanManageApiKeys(user);
    return this.apiKeysService.create(user.merchantId, user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    this.assertCanManageApiKeys(user);
    return this.apiKeysService.list(user.merchantId);
  }

  @Patch(':id/revoke')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.assertCanManageApiKeys(user);
    return this.apiKeysService.revoke(user.merchantId, user.userId, id);
  }

  @Post(':id/rotate')
  rotate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    this.assertCanManageApiKeys(user);
    return this.apiKeysService.rotate(user.merchantId, user.userId, id);
  }

  private assertCanManageApiKeys(user: AuthUser) {
    if (!canManageApiKeys(user.role)) {
      throw new ForbiddenException('You do not have permission to manage API keys');
    }
  }
}
