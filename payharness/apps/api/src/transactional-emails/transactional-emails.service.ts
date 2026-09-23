import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { MailerService } from '../mailer/mailer.service';
import { PrismaService } from '../common/prisma.service';
import {
  SendTransactionalEmailDto,
  TRANSACTIONAL_EMAIL_TEMPLATES,
  TransactionalEmailTemplate,
} from './dto/send-transactional-email.dto';

@Injectable()
export class TransactionalEmailsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TransactionalEmailsService.name);
  private worker?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {}

  async create(
    merchantId: string,
    dto: SendTransactionalEmailDto,
    idempotencyKey: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, merchantId },
      include: { customer: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    await this.assertTemplateMatchesPayment(dto.template, payment);

    const recipient = payment.customer?.email;
    if (!recipient) {
      throw new BadRequestException('Recipient email is required');
    }

    const template = this.renderTemplate(dto.template, payment);

    try {
      const email = await this.prisma.$transaction(async (tx) => {
        const created = await tx.transactionalEmail.create({
          data: {
            merchantId,
            paymentId: payment.id,
            templateKey: dto.template,
            recipient,
            subject: template.subject,
            idempotencyKey,
            status: 'QUEUED',
          },
        });

        await tx.backgroundJob.create({
          data: {
            type: 'transactional.email.send',
            payload: { transactionalEmailId: created.id },
            maxAttempts: 5,
          },
        });

        return created;
      });

      return this.publicEmail(email);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.transactionalEmail.findUnique({
          where: {
            merchantId_idempotencyKey: {
              merchantId,
              idempotencyKey,
            },
          },
        });

        if (existing) {
          return this.publicEmail(existing);
        }
      }

      throw error;
    }
  }

  async queue(
    merchantId: string,
    dto: SendTransactionalEmailDto,
    idempotencyKey?: string,
    _environment?: string,
  ) {
    const key = idempotencyKey?.trim() || randomUUID();
    return this.create(merchantId, dto, key);
  }

  onModuleInit(): void {
    // Background jobs are consumed by the durable worker.
  }

  onModuleDestroy(): void {
    if (this.worker) {
      clearInterval(this.worker);
      this.worker = undefined;
    }
  }

  async list(merchantId: string) {
    const items = await this.prisma.transactionalEmail.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return items.map((item) => this.publicEmail(item));
  }

  async get(merchantId: string, id: string) {
    const item = await this.prisma.transactionalEmail.findFirst({
      where: { id: this.normalizeId(id), merchantId },
      include: { events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!item) throw new NotFoundException('Transactional email not found');
    return this.publicEmail(item);
  }

  async usage(merchantId: string) {
    const [total, queued, processing, sent, failed, events] = await Promise.all([
      this.prisma.transactionalEmail.count({ where: { merchantId } }),
      this.prisma.transactionalEmail.count({ where: { merchantId, status: 'QUEUED' } }),
      this.prisma.transactionalEmail.count({ where: { merchantId, status: 'PROCESSING' } }),
      this.prisma.transactionalEmail.count({ where: { merchantId, status: 'SENT' } }),
      this.prisma.transactionalEmail.count({ where: { merchantId, status: 'FAILED' } }),
      this.prisma.transactionalEmailEvent.groupBy({
        by: ['type'],
        where: { merchantId },
        _count: { _all: true },
      }),
    ]);

    return {
      units: total,
      queued,
      processing,
      sent,
      failed,
      events: Object.fromEntries(events.map((event) => [event.type, event._count._all])),
    };
  }

  verifyWebhookSecret(secret?: string): boolean {
    const expected = this.config.get<string>('POSTMARK_WEBHOOK_SECRET');
    if (!expected || !secret) return false;
    const actual = Buffer.from(secret);
    const target = Buffer.from(expected);
    return actual.length === target.length && timingSafeEqual(actual, target);
  }

  async processProviderEvent(payload: Record<string, unknown>) {
    const providerMessageId = this.stringValue(payload.MessageID);
    const type = this.mapProviderEvent(this.stringValue(payload.RecordType));
    if (!providerMessageId || !type) {
      throw new BadRequestException('Unsupported transactional email webhook event');
    }

    const email = await this.prisma.transactionalEmail.findFirst({
      where: { providerMessageId },
    });
    if (!email) {
      return { received: true, ignored: true };
    }

    try {
      await this.prisma.transactionalEmailEvent.create({
        data: {
          merchantId: email.merchantId,
          transactionalEmailId: email.id,
          providerEventId: `${providerMessageId}:${type}:${this.stringValue(payload.RecordType) || ''}`,
          type,
          payload: this.safeEventPayload(payload),
        },
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
        throw error;
      }
    }

    const status =
      type === 'DELIVERED' || type === 'OPENED' || type === 'CLICKED'
        ? 'SENT'
        : type === 'BOUNCED' || type === 'COMPLAINT'
          ? 'FAILED'
          : undefined;

    if (status) {
      await this.prisma.transactionalEmail.updateMany({
        where: { id: email.id, status: { in: ['PROCESSING', 'SENT'] } },
        data: { status },
      });
    }

    return { received: true };
  }

  async processBackgroundJob(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== 'object') throw new Error('Transactional email job payload is invalid');
    const data = payload as { transactionalEmailId?: unknown };
    if (typeof data.transactionalEmailId !== 'string' || !data.transactionalEmailId) {
      throw new Error('Transactional email job payload is incomplete');
    }

    const candidate = await this.prisma.transactionalEmail.findUnique({
      where: { id: data.transactionalEmailId },
    });
    if (!candidate || candidate.status === 'SENT') return;
    if (candidate.status !== 'QUEUED') {
      throw new Error(`Transactional email ${candidate.id} is not queueable in status ${candidate.status}`);
    }

    const claimed = await this.prisma.transactionalEmail.updateMany({
      where: { id: candidate.id, status: 'QUEUED' },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) return;
    await this.sendClaimed(candidate.id);
  }

  private async sendClaimed(id: string): Promise<void> {
    const email = await this.prisma.transactionalEmail.findUnique({
      where: { id },
      include: { payment: { include: { customer: true } } },
    });
    if (!email || email.status !== 'PROCESSING' || !email.payment) return;

    try {
      const template = this.renderTemplate(email.templateKey as TransactionalEmailTemplate, email.payment);
      const result = await this.mailer.sendTransactional({
        to: email.recipient, subject: template.subject, text: template.text, html: template.html,
        metadata: { payharnessEmailId: email.id, paymentId: email.payment.id, template: email.templateKey },
      });

      await this.prisma.$transaction([
        this.prisma.transactionalEmail.update({
          where: { id },
          data: { status: 'SENT', providerMessageId: result.providerMessageId, sentAt: new Date(), lastError: null },
        }),
        this.prisma.transactionalEmailEvent.create({
          data: {
            merchantId: email.merchantId, transactionalEmailId: email.id,
            providerEventId: `local:${email.id}:sent`, type: 'SENT',
            payload: { provider: result.provider, providerMessageId: result.providerMessageId },
          },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email delivery error';
      await this.prisma.transactionalEmail.update({
        where: { id },
        data: { status: 'QUEUED', lastError: message.slice(0, 1000) },
      });
      throw error;
    }
  }

  private async assertTemplateMatchesPayment(
    template: TransactionalEmailTemplate,
    payment: Prisma.PaymentGetPayload<{ include: { customer: true } }>,
  ): Promise<void> {
    if (template === 'payment.succeeded' && payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('payment.succeeded can only be sent for a succeeded payment');
    }
    if (template === 'payment.failed' && payment.status !== 'FAILED') {
      throw new BadRequestException('payment.failed can only be sent for a failed payment');
    }
    if (template === 'payment.pending' && !['PENDING', 'REQUIRES_ACTION'].includes(payment.status)) {
      throw new BadRequestException('payment.pending can only be sent for a pending payment');
    }
    if (template === 'payment.refunded') {
      const refund = await this.prisma.transaction.findFirst({
        where: { paymentId: payment.id, type: 'REFUND', status: 'SUCCEEDED' },
        select: { id: true },
      });
      if (!refund) {
        throw new BadRequestException('payment.refunded requires a succeeded refund transaction');
      }
    }
  }

  private renderTemplate(template: TransactionalEmailTemplate, payment: Prisma.PaymentGetPayload<{ include: { customer: true } }>) {
    if (!TRANSACTIONAL_EMAIL_TEMPLATES.includes(template)) {
      throw new BadRequestException('Unsupported transactional email template');
    }

    const amount = new Intl.NumberFormat('en', {
      style: 'currency',
      currency: payment.currency,
    }).format(payment.amountCents / 100);
    const reference = payment.providerReference
      ? `••••${payment.providerReference.slice(-8)}`
      : 'pending';
    const name = payment.customer?.name ? this.escapeHtml(payment.customer.name) : 'Customer';

    const copy: Record<string, { subject: string; text: string; html: string }> = {
      'payment.succeeded': {
        subject: 'Payment confirmed',
        text: `Your payment of ${amount} has been confirmed. Reference: ${reference}.`,
        html: `<h2>Payment confirmed</h2><p>Hello ${name},</p><p>Your payment of <strong>${this.escapeHtml(amount)}</strong> has been confirmed.</p><p>Reference: <strong>${this.escapeHtml(reference)}</strong></p>`,
      },
      'payment.failed': {
        subject: 'Payment failed',
        text: `Your payment of ${amount} could not be completed. Reference: ${reference}.`,
        html: `<h2>Payment failed</h2><p>Hello ${name},</p><p>Your payment of <strong>${this.escapeHtml(amount)}</strong> could not be completed.</p><p>Reference: <strong>${this.escapeHtml(reference)}</strong></p>`,
      },
      'payment.pending': {
        subject: 'Payment pending',
        text: `Your payment of ${amount} is still pending. Reference: ${reference}.`,
        html: `<h2>Payment pending</h2><p>Hello ${name},</p><p>Your payment of <strong>${this.escapeHtml(amount)}</strong> is still pending.</p><p>Reference: <strong>${this.escapeHtml(reference)}</strong></p>`,
      },
      'payment.refunded': {
        subject: 'Payment refunded',
        text: `Your payment of ${amount} has been refunded. Reference: ${reference}.`,
        html: `<h2>Payment refunded</h2><p>Hello ${name},</p><p>Your payment of <strong>${this.escapeHtml(amount)}</strong> has been refunded.</p><p>Reference: <strong>${this.escapeHtml(reference)}</strong></p>`,
      },
      'payment.receipt': {
        subject: 'Payment receipt',
        text: `Payment receipt: ${amount}. Reference: ${reference}.`,
        html: `<h2>Payment receipt</h2><p>Hello ${name},</p><p>Amount: <strong>${this.escapeHtml(amount)}</strong></p><p>Reference: <strong>${this.escapeHtml(reference)}</strong></p><p>This is a transactional receipt from PayHarness.</p>`,
      },
    };

    return copy[template];
  }

  private safeEventPayload(payload: Record<string, unknown>) {
    return {
      recordType: this.stringValue(payload.RecordType),
      messageId: this.stringValue(payload.MessageID),
      receivedAt: this.stringValue(payload.ReceivedAt),
      deliveredAt: this.stringValue(payload.DeliveredAt),
      bouncedAt: this.stringValue(payload.BouncedAt),
      tag: this.stringValue(payload.Tag),
      description: this.stringValue(payload.Description)?.slice(0, 500),
    };
  }

  private mapProviderEvent(recordType?: string) {
    const map: Record<string, 'DELIVERED' | 'OPENED' | 'CLICKED' | 'BOUNCED' | 'COMPLAINT'> = {
      Delivery: 'DELIVERED',
      Open: 'OPENED',
      Click: 'CLICKED',
      Bounce: 'BOUNCED',
      SpamComplaint: 'COMPLAINT',
    };
    return recordType ? map[recordType] : undefined;
  }

  private stringValue(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private normalizeId(id: string) {
    return id.startsWith('eml_') ? id.slice(4) : id;
  }

  private publicEmail(email: any) {
    return {
      id: `eml_${email.id}`,
      paymentId: email.paymentId,
      template: email.templateKey,
      recipient: email.recipient,
      status: email.status,
      attempts: email.attempts,
      providerMessageId: email.providerMessageId,
      createdAt: email.createdAt,
      sentAt: email.sentAt,
      lastError: email.lastError,
      events: email.events,
    };
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char] as string);
  }

}
