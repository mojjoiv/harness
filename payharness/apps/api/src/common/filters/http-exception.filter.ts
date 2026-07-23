import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const message = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
    const errors = Array.isArray(message) ? message : [];

    // Logging only -- the response shape below is completely unchanged
    // from before this instrumentation.
    this.logDiagnostics(exception, request, status);

    response.status(status).json({
      success: false,
      code: this.codeFromStatus(status),
      message: Array.isArray(message) ? message[0] : message || 'Internal server error',
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private logDiagnostics(exception: unknown, request: any, status: number) {
    const error = exception as Error & {
      code?: string;
      meta?: unknown;
      clientVersion?: string;
      cause?: unknown;
      httpStatus?: number;
      daraja?: unknown;
    };
    const correlationId = request?.correlationId || request?.headers?.['x-correlation-id'];

    const context = {
      timestamp: new Date().toISOString(),
      correlationId,
      requestUrl: request?.url,
      httpMethod: request?.method,
      requestBody: this.safeBody(request?.body),
      merchantId: request?.user?.merchantId,
      userId: request?.user?.userId,
      status,
      constructorName: exception instanceof Error ? exception.constructor?.name : typeof exception,
    };

    // Only unexpected (500-class) exceptions get the full diagnostic dump --
    // ordinary 4xx HttpExceptions (validation errors, not-found, etc.) are
    // expected control flow, not incidents, so a lighter log line is enough
    // and avoids drowning real errors in routine 400s/404s.
    if (status >= 500 || !(exception instanceof HttpException)) {
      this.logger.error(`Unhandled exception: ${error?.message || 'unknown'}`, JSON.stringify(context));
      this.logger.error(`Stack: ${error?.stack || 'no stack available'}`);

      if (error?.cause) {
        this.logger.error(`Cause: ${this.safeStringify(error.cause)}`);
      }
      if (error?.daraja) {
        this.logger.error(`Provider response body: ${this.safeStringify(error.daraja)}`);
      }
      if (error?.httpStatus) {
        this.logger.error(`Upstream HTTP status: ${error.httpStatus}`);
      }

      if (exception instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(
          `Prisma error: code=${exception.code} clientVersion=${exception.clientVersion} meta=${this.safeStringify(exception.meta)}`,
        );
      }
    } else {
      this.logger.warn(`${context.httpMethod} ${context.requestUrl} -> ${status}: ${error?.message}`);
    }
  }

  private safeBody(body: unknown) {
    if (!body || typeof body !== 'object') return body;
    // Don't log secrets that might be in a request body (credential saves, etc).
    const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    for (const key of ['secretConfig', 'password', 'consumerSecret', 'passkey', 'secretKey', 'clientSecret']) {
      if (key in clone) clone[key] = '[redacted]';
    }
    return clone;
  }

  private safeStringify(value: unknown) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private codeFromStatus(status: number) {
    return HttpStatus[status] || 'ERROR';
  }
}
