import { BadRequestException } from '@nestjs/common';
import { PaypalPaymentService } from '../payment-providers/paypal/paypal-payment.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController PayPal query', () => {
  const paymentsService = { queryPayment: jest.fn() } as unknown as PaymentsService;
  const paypalPaymentService = { queryOrder: jest.fn() } as unknown as PaypalPaymentService;
  const controller = new PaymentsController(paymentsService, paypalPaymentService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the PayPal query flow for PayPal payments', async () => {
    jest.spyOn(paypalPaymentService, 'queryOrder').mockResolvedValue({
      paymentId: 'payment-1',
      status: 'SUCCEEDED',
      providerStatus: 'SUCCEEDED',
    } as any);

    await expect(
      controller.query({ merchantId: 'merchant-1', userId: 'user-1' } as any, 'payment-1'),
    ).resolves.toEqual({
      paymentId: 'payment-1',
      status: 'SUCCEEDED',
      providerStatus: 'SUCCEEDED',
    });
    expect(paymentsService.queryPayment).not.toHaveBeenCalled();
  });

  it('falls back to the existing query flow for non-PayPal payments', async () => {
    jest
      .spyOn(paypalPaymentService, 'queryOrder')
      .mockRejectedValue(new BadRequestException('Payment is not a PayPal payment'));
    jest.spyOn(paymentsService, 'queryPayment').mockResolvedValue({
      paymentId: 'payment-2',
      status: 'PENDING',
    } as any);

    await expect(
      controller.query({ merchantId: 'merchant-1', userId: 'user-1' } as any, 'payment-2'),
    ).resolves.toEqual({ paymentId: 'payment-2', status: 'PENDING' });
    expect(paymentsService.queryPayment).toHaveBeenCalledWith(
      'merchant-1',
      'user-1',
      'payment-2',
    );
  });

  it('does not mask real PayPal query failures', async () => {
    jest
      .spyOn(paypalPaymentService, 'queryOrder')
      .mockRejectedValue(new BadRequestException('PayPal credentials are incomplete'));

    await expect(
      controller.query({ merchantId: 'merchant-1', userId: 'user-1' } as any, 'payment-3'),
    ).rejects.toThrow('PayPal credentials are incomplete');
    expect(paymentsService.queryPayment).not.toHaveBeenCalled();
  });
});
