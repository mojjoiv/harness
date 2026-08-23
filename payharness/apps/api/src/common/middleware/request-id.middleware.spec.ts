import { RequestIdMiddleware } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('preserves an incoming request id', () => {
    const request = {
      header: jest.fn().mockReturnValue('req-123'),
      headers: {},
    } as any;
    const response = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(request, response, next);

    expect(request.headers['x-request-id']).toBe('req-123');
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
    expect(next).toHaveBeenCalled();
  });

  it('generates and propagates a request id when none is supplied', () => {
    const request = {
      header: jest.fn().mockReturnValue(undefined),
      headers: {},
    } as any;
    const response = { setHeader: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(request, response, next);

    const requestId = request.headers['x-request-id'];
    expect(requestId).toEqual(expect.any(String));
    expect(requestId).not.toHaveLength(0);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', requestId);
    expect(next).toHaveBeenCalled();
  });
});
