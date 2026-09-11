import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { RefundService } from './refund.service';

describe('PaymentsController environment safety and orchestration', () => {
  let controller: PaymentsController;
  let paymentsService: jest.Mocked<
    Pick<
      PaymentsService,
      | 'createPayment'
      | 'createMpesaStk'
      | 'createStripeIntent'
      | 'createPaypalOrder'
      | 'capturePaypalOrder'
      | 'queryPaypalOrder'
      | 'queryPayment'
      | 'getPayment'
    >
  >;
  let refundService: jest.Mocked<Pick<RefundService, 'refund'>>;

  beforeEach(() => {
    paymentsService = {
      createPayment: jest.fn(),
      createMpesaStk: jest.fn(),
      createStripeIntent: jest.fn(),
      createPaypalOrder: jest.fn(),
      capturePaypalOrder: jest.fn(),
      queryPaypalOrder: jest.fn(),
      queryPayment: jest.fn(),
      getPayment: jest.fn(),
    };
    refundService = {
      refund: jest.fn(),
    };
    controller = new PaymentsController(
      paymentsService as unknown as PaymentsService,
      refundService as unknown as RefundService,
    );
  });

  it('routes unified payment creation to the orchestration service', () => {
    const user = {
      userId: 'user-1',
      merchantId: 'merchant-1',
      role: 'DEVELOPER',
      type: 'api_key',
      environment: 'SANDBOX',
    } as any;
    const dto = {
      provider: 'STRIPE',
      amountCents: 1000,
      currency: 'USD',
      environment: 'LIVE',
    } as any;

    controller.create(user, dto);

    expect(paymentsService.createPayment).toHaveBeenCalledWith(
      'merchant-1',
      'user-1',
      expect.objectContaining({
        provider: 'STRIPE',
        environment: 'SANDBOX',
      }),
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

    expect(paymentsService.createPaypalOrder).toHaveBeenCalledWith(
      'merchant-2',
      'user-2',
      expect.objectContaining({ environment: 'LIVE' }),
    );
  });

  it('delegates a full refund to the refund service', () => {
    const user = {
      userId: 'user-6',
      merchantId: 'merchant-6',
      type: 'merchant',
    } as any;

    controller.refund(user, 'payment-6', {} as any);

    expect(refundService.refund).toHaveBeenCalledWith(
      'merchant-6',
      'user-6',
      'payment-6',
      undefined,
      undefined,
    );
  });

  it('delegates a partial refund amount to the refund service', () => {
    const user = {
      userId: 'user-7',
      merchantId: 'merchant-7',
      type: 'merchant',
    } as any;

    controller.refund(user, 'payment-7', { amountCents: 300 } as any, 'refund-key-7');

    expect(refundService.refund).toHaveBeenCalledWith(
      'merchant-7',
      'user-7',
      'payment-7',
      'refund-key-7',
      300,
    );
  });

  it('delegates the canonical payment resource endpoint to the service', () => {
    const user = {
      userId: 'user-4',
      merchantId: 'merchant-4',
      type: 'merchant',
    } as any;

    controller.get(user, 'payment-4');

    expect(paymentsService.getPayment).toHaveBeenCalledWith(
      'merchant-4',
      'user-4',
      'payment-4',
    );
  });

  it('delegates the generic payment query endpoint to the service', () => {
    const user = {
      userId: 'user-5',
      merchantId: 'merchant-5',
      type: 'merchant',
    } as any;

    controller.query(user, 'payment-5');

    expect(paymentsService.queryPayment).toHaveBeenCalledWith(
      'merchant-5',
      'user-5',
      'payment-5',
    );
  });
});
