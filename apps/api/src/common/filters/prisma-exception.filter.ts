import type { ArgumentsHost} from '@nestjs/common';
import { Catch, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { ErrorCode, type ApiErrorBody } from '@mkt-seo/shared';

/**
 * Section 11 — Translates Prisma errors to our error envelope. The Nest-default
 * 500 leaks `prisma` internals; we surface a structured code instead.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception: Prisma.PrismaClientKnownRequestError | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.warn({ err: exception.message }, 'Prisma validation error');
      const body: ApiErrorBody = {
        success: false,
        error: { code: ErrorCode.VALIDATION_ERROR, message: 'Tham số DB không hợp lệ' },
      };
      res.status(HttpStatus.BAD_REQUEST).json(body);
      return;
    }

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = ErrorCode.DATABASE_ERROR;
    let message = 'Lỗi cơ sở dữ liệu';

    switch (exception.code) {
      case 'P2002': // Unique constraint failed
        status = HttpStatus.CONFLICT;
        code = ErrorCode.RESOURCE_ALREADY_EXISTS;
        message = 'Bản ghi đã tồn tại';
        break;
      case 'P2025': // Record not found
        status = HttpStatus.NOT_FOUND;
        code = ErrorCode.RESOURCE_NOT_FOUND;
        message = 'Không tìm thấy bản ghi';
        break;
      case 'P2003': // Foreign key constraint failed
        status = HttpStatus.BAD_REQUEST;
        code = ErrorCode.VALIDATION_ERROR;
        message = 'Vi phạm ràng buộc khóa ngoại';
        break;
      default:
        this.logger.error({ err: exception }, 'Unknown Prisma error');
    }

    const body: ApiErrorBody = {
      success: false,
      error: { code, message, details: { prisma_code: exception.code } },
    };
    res.status(status).json(body);
  }
}
