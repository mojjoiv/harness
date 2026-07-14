import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as https from 'https';
import MailComposer from 'nodemailer/lib/mail-composer';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends transactional email via the Gmail API over HTTPS, NOT SMTP.
 *
 * Why: Render (like most PaaS hosts) blocks or silently drops outbound SMTP
 * connections on ports 465/587 to Gmail regardless of auth method -- this is
 * a TCP/IP-reputation level block, not an auth problem, so plain-password
 * *and* OAuth2-over-SMTP both fail identically in that environment. Calling
 * the Gmail REST API over port 443 sidesteps this entirely, since that's
 * ordinary HTTPS traffic. Nodemailer is still used here, but only for its
 * MailComposer utility to build a correctly-formatted raw MIME message --
 * never for actual SMTP transport.
 *
 * Requires one-time setup: a Google Cloud OAuth2 client (Desktop app type)
 * with the Gmail API enabled and the gmail.send scope, plus a refresh token
 * generated once via scripts/generate-gmail-refresh-token.ts. See that
 * script's header comment for step-by-step instructions.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly oauth2Client: OAuth2Client | null;
  private readonly senderEmail: string | undefined;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    const clientId = this.config.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.config.get<string>('GMAIL_CLIENT_SECRET');
    const refreshToken = this.config.get<string>('GMAIL_REFRESH_TOKEN');
    this.senderEmail = this.config.get<string>('GMAIL_SENDER_EMAIL');
    this.fromName = this.config.get<string>('GMAIL_SENDER_NAME') || 'PayHarness';

    if (clientId && clientSecret && refreshToken && this.senderEmail) {
      this.oauth2Client = new OAuth2Client(clientId, clientSecret);
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    } else {
      this.oauth2Client = null;
      this.logger.warn(
        'Gmail credentials are not fully configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / ' +
          'GMAIL_REFRESH_TOKEN / GMAIL_SENDER_EMAIL) -- outgoing email is disabled. Emails will be ' +
          'logged instead of sent.',
      );
    }
  }

  /**
   * Sends an email. Never throws -- a failed or unconfigured send is logged
   * and swallowed so that the calling action (approving a merchant, creating
   * a user, etc.) always succeeds regardless of email delivery status.
   */
  async send(input: SendEmailInput): Promise<boolean> {
    if (!this.oauth2Client || !this.senderEmail) {
      this.logger.log(`[email disabled] Would send "${input.subject}" to ${input.to}`);
      return false;
    }

    try {
      const raw = await this.buildRawMessage(input);
      const accessToken = await this.oauth2Client.getAccessToken();
      if (!accessToken.token) {
        throw new Error('Failed to obtain a Gmail access token from the refresh token');
      }
      await this.sendViaGmailApi(raw, accessToken.token);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${input.to}: ${(error as Error).message}`);
      return false;
    }
  }

  private buildRawMessage(input: SendEmailInput): Promise<string> {
    const composer = new MailComposer({
      from: `"${this.fromName}" <${this.senderEmail}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    return new Promise((resolve, reject) => {
      composer.compile().build((err: Error | null, message: Buffer) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
      });
    });
  }

  private sendViaGmailApi(raw: string, accessToken: string): Promise<void> {
    const body = JSON.stringify({ raw });

    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: 'gmail.googleapis.com',
          path: '/gmail/v1/users/me/messages/send',
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if ((res.statusCode || 500) >= 300) {
              reject(new Error(`Gmail API responded with ${res.statusCode}: ${data}`));
              return;
            }
            resolve();
          });
        },
      );
      request.on('error', reject);
      request.on('timeout', () => request.destroy(new Error('Gmail API request timed out')));
      request.write(body);
      request.end();
    });
  }
}
