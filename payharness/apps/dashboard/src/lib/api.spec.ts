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
    (global.fetch as jest.Mock).mockResolvedValue(new Response(
      JSON.stringify({ success: true, data: { id: 'p1' }, meta: { page: 1 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(apiRequest('/payments')).resolves.toEqual({
      data: { id: 'p1' },
      meta: { page: 1 },
    });

    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3000/payments', expect.objectContaining({
      method: 'GET',
      headers: expect.any(Headers),
    }));
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers.get('Authorization')).toBe('Bearer test-token');
  });

  it('normalizes API failures into ApiError', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response(
      JSON.stringify({ message: 'Payment failed', code: 'PAYMENT_FAILED', errors: ['invalid'] }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    ));

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
