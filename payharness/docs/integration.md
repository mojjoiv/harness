# Integration

The first SDK package lives in `packages/sdk-js`.

```ts
import { PayHarnessClient } from '@payharness/sdk-js';

const client = new PayHarnessClient({ apiKey: 'ph_sandbox_...' });
await client.createCheckoutSession({
  amountCents: 1000,
  currency: 'USD',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
});
```

Hosted checkout, live provider calls, and signature verification are planned for later versions.
