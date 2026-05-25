import type {
  ArgumentsHost} from '@nestjs/common';
import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode, type ApiErrorBody } from '@mkt-seo/shared';

interface ExceptionPayload {
  code?: ErrorCode;
  message?: string | string[];
  details?: Record<string, unknown>;
}

/**
 * Section 11 — uniform error wrapper. Every HttpException is converted to the
 * `{ success: false, error: { code, message, details? } }` envelope.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const raw = exception.getResponse();
    const payload: ExceptionPayload =
      typeof raw === 'string' ? { message: raw } : (raw as ExceptionPayload);

    const code = payload.code ?? this.defaultCodeForStatus(status);
    const rawMessage = payload.message ?? exception.message ?? 'Request failed';
    const message = Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage;

    if (status >= 500) {
      this.logger.error(
        { err: exception, path: req.url, method: req.method, code },
        'Unhandled exception',
      );
    }

    const body: ApiErrorBody = {
      success: false,
      error: {
        code,
        message,
        ...(payload.details ? { details: payload.details } : {}),
      },
    };
    res.status(status).json(body);
  }

  private defaultCodeForStatus(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.INVALID_CREDENTIALS;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.RESOURCE_FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.RESOURCE_NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.RESOURCE_ALREADY_EXISTS;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMITED;
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.VALIDATION_ERROR;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
