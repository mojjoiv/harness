import { MpesaPayoutCallbackController } from './mpesa-payout-callback.controller';

describe('MpesaPayoutCallbackController', () => {
  it('forwards the provider callback to the result handler', async () => {
    const callbacks = {
      handleResult: jest.fn().mockResolvedValue({ status: 'SUCCEEDED' }),
      handleTimeout: jest.fn(),
    };
    const controller = new MpesaPayoutCallbackController(callbacks as never);
    const body = { ResultCode: 0, ConversationID: '12345-abc' };

    await expect(controller.callback('merchant-1', body)).resolves.toEqual({
      status: 'SUCCEEDED',
    });
    expect(callbacks.handleResult).toHaveBeenCalledWith('merchant-1', body);
  });

  it('forwards the explicit result route to the result handler', async () => {
    const callbacks = {
      handleResult: jest.fn().mockResolvedValue({ status: 'SUCCEEDED' }),
      handleTimeout: jest.fn(),
    };
    const controller = new MpesaPayoutCallbackController(callbacks as never);
    const body = { ResultCode: 0, ConversationID: '12345-abc' };

    await expect(controller.result('merchant-1', body)).resolves.toEqual({
      status: 'SUCCEEDED',
    });
    expect(callbacks.handleResult).toHaveBeenCalledWith('merchant-1', body);
  });

  it('forwards the explicit timeout route to the timeout handler', async () => {
    const callbacks = {
      handleResult: jest.fn(),
      handleTimeout: jest.fn().mockResolvedValue({ status: 'FAILED' }),
    };
    const controller = new MpesaPayoutCallbackController(callbacks as never);
    const body = { ResultCode: 1037, ConversationID: '12345-abc' };

    await expect(controller.timeout('merchant-1', body)).resolves.toEqual({
      status: 'FAILED',
    });
    expect(callbacks.handleTimeout).toHaveBeenCalledWith('merchant-1', body);
  });
});
