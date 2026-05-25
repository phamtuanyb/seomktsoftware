import type {
  CallHandler,
  ExecutionContext} from '@nestjs/common';
import {
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { tap, type Observable } from 'rxjs';
import type { Request } from 'express';

/** Section 16 — log every request with method, path, status, duration. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: { id?: string } }>();
    const started = Date.now();
    const { method, originalUrl } = req;
    const userId = req.user?.id;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - started;
          this.logger.log(`${method} ${originalUrl} ${duration}ms user=${userId ?? '-'}`);
        },
        error: (err: Error) => {
          const duration = Date.now() - started;
          this.logger.warn(`${method} ${originalUrl} FAIL ${duration}ms ${err.message}`);
        },
      }),
    );
  }
}
