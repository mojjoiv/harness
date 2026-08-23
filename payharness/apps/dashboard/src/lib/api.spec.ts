import { apiRequest, ApiError, buildApiUrl } from './api';

const getToken = jest.fn();
const clearSession = jest.fn();

jest.mock('./auth', () => ({
  getToken: () => getToken(),
  clearSession: () => clearSession(),
}));

describe('dashboard API client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getToken.mockReturnValue('test-token');
    global.fetch = jest.fn();
  });

  it('builds API URLs consistently', () => {
    expect(buildApiUrl('/payments')).toBe('http://localhost:3000/payments');
    expect(buildApiUrl('payments')).toBe('http://localhost:3000/payments');
  });

  it('unwraps successful API responses and sends authorization', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'p1' }, meta: { page: 1 } }),
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
    });

    await expect(apiRequest('/payments')).resolves.toEqual({
      data: { id: 'p1' },
      meta: { page: 1 },
    });

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/payments', expect.objectContaining({
      method: 'GET',
      headers: expect.any(Object),
    }));
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('normalizes API failures into ApiError', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Payment failed', code: 'PAYMENT_FAILED', errors: ['invalid'] }),
      headers: {
        get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null),
      },
    });

    const request = apiRequest('/payments', { method: 'POST' });
    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({
      message: 'Payment failed',
      code: 'PAYMENT_FAILED',
      status: 422,
      errors: ['invalid'],
    });
  });
});
