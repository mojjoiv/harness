import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export const TRANSACTIONAL_EMAIL_TEMPLATES = [
  'payment.succeeded',
  'payment.failed',
  'payment.pending',
  'payment.refunded',
  'payment.receipt',
] as const;

export type TransactionalEmailTemplate = (typeof TRANSACTIONAL_EMAIL_TEMPLATES)[number];

export class SendTransactionalEmailDto {
  @IsIn(TRANSACTIONAL_EMAIL_TEMPLATES)
  template!: TransactionalEmailTemplate;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  to?: string;

  @IsUUID()
  paymentId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  idempotencyKey?: string;
}
