import type { CallHandler, ExecutionContext} from '@nestjs/common';
import { Injectable, type NestInterceptor } from '@nestjs/common';
import { map, type Observable } from 'rxjs';
import type { Response } from 'express';
import type { ApiResponseBody } from '@mkt-seo/shared';

/**
 * Section 6 — wraps every successful payload in `{ success: true, data, meta? }`.
 * Skipped for SSE / streaming responses (Section 8 TN4) — those bypass the
 * interceptor by writing to the raw response.
 */
@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ApiResponseBody<T>> {
  intercept(ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiResponseBody<T>> {
    const res = ctx.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((value) => {
        // SSE / stream / file responses already wrote to the socket — skip.
        if (
          res.headersSent ||
          (res.getHeader('content-type') as string | undefined)?.includes('event-stream')
        ) {
          return value as unknown as ApiResponseBody<T>;
        }
        // Detect explicit meta envelope: `{ data, meta }`.
        if (value && typeof value === 'object' && 'data' in value && 'meta' in value) {
          const { data, meta } = value as { data: T; meta: Record<string, unknown> };
          return { success: true, data, meta };
        }
        return { success: true, data: value as T };
      }),
    );
  }
}
