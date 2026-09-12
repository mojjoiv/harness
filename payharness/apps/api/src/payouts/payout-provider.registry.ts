import { BadRequestException, Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import {
  PayoutExecutionInput,
  PayoutExecutionResult,
  PayoutProvider,
} from './payout-provider.interface';

@Injectable()
export class PayoutProviderRegistry {
  private readonly providers = new Map<Provider, PayoutProvider>();

  register(provider: PayoutProvider): void {
    this.providers.set(provider.provider, provider);
  }

  async execute(input: PayoutExecutionInput): Promise<PayoutExecutionResult> {
    const provider = this.providers.get(input.provider);
    if (!provider) {
      throw new BadRequestException(
        `Payout provider ${input.provider} is not configured for execution`,
      );
    }

    return provider.execute(input);
  }
}
