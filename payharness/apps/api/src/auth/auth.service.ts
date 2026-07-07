import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { compareRoles } from '../common/authz/roles';
import { slugify } from '../common/utils/slug.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }

    const baseSlug = slugify(dto.merchantName);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          passwordHash,
        },
      });
      const merchant = await tx.merchant.create({
        data: {
          name: dto.merchantName,
          slug,
          users: { create: { userId: user.id, role: 'OWNER' } },
        },
      });
      return { user, merchant };
    });

    return this.authResponse(result.user, result.merchant.id, 'OWNER');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { merchantUsers: true },
    });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const merchantUser = [...user.merchantUsers].sort((left, right) => compareRoles(right.role, left.role))[0];
    if (!merchantUser) {
      throw new UnauthorizedException('User is not attached to a merchant');
    }

    await this.auditLogs.create({
      merchantId: merchantUser.merchantId,
      userId: user.id,
      action: 'auth.login',
      entity: 'user',
      entityId: user.id,
    });

    return this.authResponse(user, merchantUser.merchantId, merchantUser.role);
  }

  private async authResponse(user: { id: string; email: string; name: string }, merchantId: string, role: string) {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      userId: user.id,
      email: user.email,
      merchantId,
      role,
      type: 'merchant',
    });
    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      merchantId,
      role,
      type: 'merchant',
    };
  }
}
