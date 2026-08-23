import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  const makeHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status };
    const request = { method: 'GET', url: '/test' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as any;

    return { host, status, json };
  };

  it('handles HttpException responses', () => {
    const { host, status, json } = makeHost();
    const exception = new HttpException(
      { message: 'Not found' },
      HttpStatus.NOT_FOUND,
    );

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Not found',
        errors: [],
        path: '/test',
      }),
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
      }),
    );
  });

  it('handles unknown exceptions as internal server errors', () => {
    const { host, status, json } = makeHost();

    filter.catch('unexpected failure', host);

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
