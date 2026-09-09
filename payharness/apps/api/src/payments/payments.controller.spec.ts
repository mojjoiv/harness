import { PaypalPaymentService } from '../payment-providers/paypal/paypal-payment.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController environment safety', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<
    Pick<PaymentsService, 'createMpesaStk' | 'createStripeIntent' | 'queryPayment'>
  >;
  let paypalPaymentService: jest.Mocked<Pick<PaypalPaymentService, 'createOrder'>>;

  beforeEach(() => {
    paymentsService = {
      createMpesaStk: jest.fn(),
      createStripeIntent: jest.fn(),
      queryPayment: jest.fn(),
    };
    paypalPaymentService = { createOrder: jest.fn() };
    controller = new PaymentsController(
      paymentsService as unknown as PaymentsService,
      paypalPaymentService as unknown as PaypalPaymentService,
    );
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

  it('forces LIVE API-key PayPal requests back to the key environment', () => {
    const user = {
      userId: 'user-2',
      merchantId: 'merchant-2',
      role: 'DEVELOPER',
      type: 'api_key',
      environment: 'LIVE',
    } as any;

    const dto = {
      amountCents: 2500,
      currency: 'USD',
      environment: 'SANDBOX',
    } as any;

    controller.paypalOrder(user, dto);

    expect(paypalPaymentService.createOrder).toHaveBeenCalledWith(
      'merchant-2',
      'user-2',
      expect.objectContaining({ environment: 'LIVE' }),
    );
  });

  it('rejects simulated PayPal outcomes', () => {
    const user = {
      userId: 'user-3',
      merchantId: 'merchant-3',
      role: 'DEVELOPER',
      type: 'api_key',
      environment: 'SANDBOX',
    } as any;

    expect(() =>
      controller.paypalOrder(user, {
        amountCents: 1000,
        currency: 'USD',
        environment: 'SANDBOX',
        simulateOutcome: 'SUCCEEDED',
      } as any),
    ).toThrow('PayPal does not support simulated outcomes');
    expect(paypalPaymentService.createOrder).not.toHaveBeenCalled();
  });
});
