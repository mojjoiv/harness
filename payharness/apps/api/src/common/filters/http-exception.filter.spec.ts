import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  const makeHost = (requestId = 'req-test-123') => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = {
      status,
      headersSent: false,
      setHeader: jest.fn(),
    };
    const request = {
      method: 'GET',
      url: '/test',
      headers: { 'x-request-id': requestId },
    };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any;

    return { host, status, json, response };
  };

  it('handles HttpException responses with a string message', () => {
    const { host, status, json, response } = makeHost();
    const exception = new HttpException('Not found', HttpStatus.NOT_FOUND);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.setHeader).toHaveBeenCalledWith('x-request-id', 'req-test-123');
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Not found',
        errors: [],
        path: '/test',
        requestId: 'req-test-123',
        errorId: expect.any(String),
      }),
    );
  });

  it('handles HttpException responses with an array message', () => {
    const { host, status, json } = makeHost();
    const exception = new HttpException(
      { message: ['invalid email', 'invalid name'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'invalid email',
        errors: ['invalid email', 'invalid name'],
      }),
    );
  });

  it('handles HttpException responses with an object message', () => {
    const { host, status, json } = makeHost();
    const exception = new HttpException(
      { message: 'Unauthorized' },
      HttpStatus.UNAUTHORIZED,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Unauthorized', errors: [] }),
    );
  });

  it('handles generic Error responses as internal server errors', () => {
    const { host, status, json } = makeHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'boom',
        errors: [],
        path: '/test',
        requestId: 'req-test-123',
        errorId: expect.any(String),
      }),
    );
  });

  it('falls back to the internal server message for an empty Error', () => {
    const { host, status, json } = makeHost();

    filter.catch(new Error(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal server error',
      }),
    );
  });

  it('handles unknown exceptions as internal server errors', () => {
    const { host, status, json } = makeHost();

    filter.catch({ reason: 'unexpected failure' }, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Internal server error',
        errors: [],
        path: '/test',
      }),
    );
  });
});
