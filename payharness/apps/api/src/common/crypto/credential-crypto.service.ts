import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

interface EncryptedPayload {
  iv: string;
  tag: string;
  data: string;
}

@Injectable()
export class CredentialCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(value: Record<string, unknown>): EncryptedPayload {
    const key = this.key();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);

    return {
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload): Record<string, unknown> {
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(payload.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.data, 'base64')),
        decipher.final(),
      ]);
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      // A raw Error/TypeError here (bad IV, auth tag mismatch from a
      // rotated CREDENTIAL_ENCRYPTION_KEY, malformed stored payload) is
      // NOT an HttpException, so the global filter was collapsing it to
      // an opaque 500 with no detail. Wrapping it turns that into a
      // clear, logged, actionable error instead.
      throw new InternalServerErrorException(
        `Stored credentials could not be decrypted (${(error as Error).message}). ` +
          'This usually means CREDENTIAL_ENCRYPTION_KEY changed since these credentials were saved -- ' +
          'reconnect the provider to re-save them under the current key.',
      );
    }
  }

  mask(value: unknown): string {
    const text = String(value ?? '');
    if (text.length <= 8) {
      return '********';
    }
    return `${text.slice(0, 4)}****${text.slice(-4)}`;
  }

  private key(): Buffer {
    const raw = this.config.get<string>('CREDENTIAL_ENCRYPTION_KEY');
    const key = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new InternalServerErrorException('CREDENTIAL_ENCRYPTION_KEY must be a base64 encoded 32 byte key');
    }
    return key;
  }
}
