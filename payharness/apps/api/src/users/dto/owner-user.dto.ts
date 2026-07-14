import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

const INVITABLE_ROLES = [UserRole.ADMIN, UserRole.DEVELOPER, UserRole.VIEWER] as const;

export class CreateOwnerUserDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsIn(INVITABLE_ROLES)
  role: UserRole;
}

export class UpdateOwnerUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsIn(INVITABLE_ROLES)
  role?: UserRole;
}
