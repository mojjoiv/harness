import fs from 'node:fs';
import path from 'node:path';

describe('PayHarness API v1 certification', () => {
  const root = path.resolve(__dirname, '..');

  it('registers stable versioned payment and checkout endpoints', () => {
    const payments = fs.readFileSync(path.join(root, 'api-v1', 'api-v1-payments.controller.ts'), 'utf8');
    const checkout = fs.readFileSync(path.join(root, 'api-v1', 'api-v1-checkout-sessions.controller.ts'), 'utf8');
    const moduleFile = fs.readFileSync(path.join(root, 'api-v1', 'api-v1.module.ts'), 'utf8');
    const docs = fs.readFileSync(path.resolve(root, '../../../docs/API_V1.md'), 'utf8');

    expect(payments).toContain("@Controller('api/v1/payments')");
    expect(payments).toContain("@Post()");
    expect(payments).toContain("@Get(':id')");
    expect(payments).toContain("@Get(':id/query')");
    expect(payments).toContain("@Post(':id/refund')");
    expect(checkout).toContain("@Controller('api/v1/checkout-sessions')");
    expect(checkout).toContain("@Post()");
    expect(checkout).toContain("@Get(':id')");
    expect(moduleFile).toContain('ApiV1PaymentsController');
    expect(moduleFile).toContain('ApiV1CheckoutSessionsController');
    expect(docs).toContain('/api/v1');
    expect(docs).toContain('Idempotency-Key');
    expect(docs).toContain('ph_sandbox_');
  });
});
