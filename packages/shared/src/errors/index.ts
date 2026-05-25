/**
 * Error codes — Section 11.
 * Every API error response carries one of these in `error.code`.
 */
export enum ErrorCode {
  // Auth
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Resources
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  RESOURCE_FORBIDDEN = 'RESOURCE_FORBIDDEN',

  // Quota & Rate Limit
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMITED = 'RATE_LIMITED',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  PLAN_REQUIRED = 'PLAN_REQUIRED',

  // External APIs
  AI_PROVIDER_ERROR = 'AI_PROVIDER_ERROR',
  AI_PROVIDER_TIMEOUT = 'AI_PROVIDER_TIMEOUT',
  WP_CONNECTION_ERROR = 'WP_CONNECTION_ERROR',
  WP_AUTH_ERROR = 'WP_AUTH_ERROR',

  // Internal
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta?: {
    cursor?: string | null;
    has_more?: boolean;
    [key: string]: unknown;
  };
}

export type ApiResponseBody<T> = ApiSuccessBody<T> | ApiErrorBody;
