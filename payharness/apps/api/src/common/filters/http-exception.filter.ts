import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

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
        : 'Internal server error';

    const message =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] }).message;

    const errors = Array.isArray(message) ? message : [];

    // ===== LOG THE FULL EXCEPTION =====
    if (exception instanceof Error) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception.stack,
      );
    } else {
      this.logger.error(
        `${request.method} ${request.url}`,
        JSON.stringify(exception),
      );
    }
    // ================================

    response.status(status).json({
      success: false,
      code: this.codeFromStatus(status),
      message: Array.isArray(message)
        ? message[0]
        : message || 'Internal server error',
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private codeFromStatus(status: number) {
    return HttpStatus[status] || 'ERROR';
  }
}
