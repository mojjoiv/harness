import { Global, Module } from '@nestjs/common';
import { MailerModule } from '../mailer/mailer.module';
import { TransactionalEmailsController } from './transactional-emails.controller';
import { TransactionalEmailsService } from './transactional-emails.service';

@Global()
@Module({
  imports: [MailerModule],
  controllers: [TransactionalEmailsController],
  providers: [TransactionalEmailsService],
  exports: [TransactionalEmailsService],
})
export class TransactionalEmailsModule {}
