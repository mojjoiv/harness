import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaypalCheckoutController } from './paypal-checkout.controller';

describe('PaypalCheckoutController', () => {
  const prisma = {
    payment: { findFirst: jest.fn() },
  } as any;
  const paypalPaymentService = {
    captureOrder: jest.fn(),
  } as any;
  let controller: PaypalCheckoutController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PaypalCheckoutController(prisma, paypalPaymentService);
  });

  it('captures a PayPal payment after a valid approval return', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      merchantId: 'merchant-1',
      provider: 'PAYPAL',
      providerReference: 'ORDER-1',
    });
    paypalPaymentService.captureOrder.mockResolvedValue({
      paymentId: 'payment-1',
      status: 'SUCCEEDED',
      providerStatus: 'COMPLETED',
    });

    const result = await controller.success('payment-1', 'ORDER-1');

    expect(result).toEqual({
      paymentId: 'payment-1',
      status: 'SUCCEEDED',
      providerStatus: 'COMPLETED',
    });
    expect(paypalPaymentService.captureOrder).toHaveBeenCalledWith(
      'merchant-1',
      undefined,
      'payment-1',
    );
  });

  it('rejects a missing paymentId or token', async () => {
    await expect(controller.success(undefined, 'ORDER-1')).rejects.toThrow(
      new BadRequestException('PayPal paymentId and token are required'),
    );
    await expect(controller.success('payment-1', undefined)).rejects.toThrow(
      new BadRequestException('PayPal paymentId and token are required'),
    );
  });

  it('rejects an unknown PayPal payment', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);

    await expect(controller.success('payment-1', 'ORDER-1')).rejects.toThrow(
      new NotFoundException('PayPal payment not found'),
    );
  });

  it('rejects a token that does not match the PayPal order', async () => {
    prisma.payment.findFirst.mockResolvedValue({
      id: 'payment-1',
      merchantId: 'merchant-1',
      provider: 'PAYPAL',
      providerReference: 'ORDER-1',
    });

    await expect(controller.success('payment-1', 'ORDER-2')).rejects.toThrow(
      new BadRequestException('Invalid PayPal approval token'),
    );
    expect(paypalPaymentService.captureOrder).not.toHaveBeenCalled();
  });
});
