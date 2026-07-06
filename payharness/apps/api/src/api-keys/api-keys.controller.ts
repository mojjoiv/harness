import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ApiKeysService } from './api-keys.service';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user.merchantId, user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.apiKeysService.list(user.merchantId);
  }

  @Patch(':id/revoke')
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user.merchantId, user.userId, id);
  }
}
