import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma.service';
import { PlatformLoginDto } from './dto/platform-login.dto';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const user = await this.prisma.platformUser.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'platform',
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      role: user.role,
      type: 'platform',
    };
  }

  async profile(userId: string) {
    const user = await this.prisma.platformUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Platform user not found');
    }
    return user;
  }
}
