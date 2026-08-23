import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message || 'Internal server error'
          : 'Internal server error';

    const message =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] }).message;

    const errors = Array.isArray(message) ? message : [];
    const requestId = request.headers?.['x-request-id'] || randomUUID();
    const errorId = randomUUID();

    if (!response.headersSent) {
      response.setHeader('x-request-id', requestId);
    }

    this.logger.error(
      JSON.stringify({
        event: 'http.exception',
        errorId,
        requestId,
        status,
        method: request.method,
        path: request.url,
        exception: {
          name: exception instanceof Error ? exception.name : typeof exception,
          message: exception instanceof Error ? exception.message : undefined,
          stack: exception instanceof Error ? exception.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      }),
    );

    response.status(status).json({
      success: false,
      code: this.codeFromStatus(status),
      message: Array.isArray(message)
        ? message[0]
        : message || 'Internal server error',
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      errorId,
    });
  }

  private codeFromStatus(status: number) {
    return HttpStatus[status] || 'ERROR';
  }
}
