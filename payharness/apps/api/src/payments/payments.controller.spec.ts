import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController environment safety', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<Pick<PaymentsService, 'createMpesaStk' | 'createStripeIntent' | 'createPaypalOrder' | 'queryPayment'>>;

  beforeEach(() => {
    paymentsService = {
      createMpesaStk: jest.fn(),
      createStripeIntent: jest.fn(),
      createPaypalOrder: jest.fn(),
      queryPayment: jest.fn(),
    };
    controller = new PaymentsController(paymentsService as unknown as PaymentsService);
  });

  it('forces API-key requests to use the environment encoded in the API key', () => {
    const user = {
      userId: 'user-1',
      merchantId: 'merchant-1',
      role: 'DEVELOPER',
      type: 'api_key',
      environment: 'SANDBOX',
    } as any;

    const dto = {
      amountCents: 1000,
      currency: 'KES',
      environment: 'LIVE',
      phoneNumber: '254700000000',
    } as any;

    controller.mpesaStk(user, dto);

    expect(paymentsService.createMpesaStk).toHaveBeenCalledWith(
      'merchant-1',
      'user-1',
      expect.objectContaining({ environment: 'SANDBOX' }),
    );
  });

  it('does not rewrite the environment for dashboard JWT callers', () => {
    const user = {
      userId: 'user-1',
      merchantId: 'merchant-1',
      role: 'OWNER',
      type: 'merchant',
    } as any;

    const dto = {
      amountCents: 1000,
      currency: 'KES',
      environment: 'LIVE',
    } as any;

    controller.stripeIntent(user, dto);

    expect(paymentsService.createStripeIntent).toHaveBeenCalledWith(
      'merchant-1',
      'user-1',
      expect.objectContaining({ environment: 'LIVE' }),
    );
  });

  it('forces LIVE API-key requests back to the key environment', () => {
    const user = {
      userId: 'user-2',
      merchantId: 'merchant-2',
      role: 'DEVELOPER',
      type: 'api_key',
      environment: 'LIVE',
    } as any;

    const dto = {
      amountCents: 2500,
      currency: 'KES',
      environment: 'SANDBOX',
    } as any;

    controller.paypalOrder(user, dto);

    expect(paymentsService.createPaypalOrder).toHaveBeenCalledWith(
      'merchant-2',
      'user-2',
      expect.objectContaining({ environment: 'LIVE' }),
    );
  });
});
