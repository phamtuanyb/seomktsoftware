/**
 * DTOs that are shared between API and Web — auth payloads, common envelopes.
 * Module-specific DTOs live in their feature folders.
 */

import type { PlanTier, UserRole } from '../plans';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: UserRole;
  plan: PlanTier;
  email_verified: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  /** Seconds until access_token expires. */
  expires_in: number;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface RefreshResponse {
  tokens: AuthTokens;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface MessageResponse {
  message: string;
}
