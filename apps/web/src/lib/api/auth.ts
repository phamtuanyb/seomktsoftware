import type {
  AuthUser,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  MessageResponse,
} from '@mkt-seo/shared';
import { api } from './client';

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

/**
 * The same-origin auth endpoints hit Next route handlers under /api/auth/*,
 * which talk to the backend AND set the httpOnly access cookie. The browser
 * never sees the JWT directly.
 */
export const authApi = {
  register: (body: RegisterRequest) =>
    fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    }).then(handleAuthResponse),

  login: (body: LoginRequest) =>
    fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    }).then(handleAuthResponse),

  logout: () =>
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).then(
      handleMessageResponse,
    ),

  forgotPassword: (email: string) => api.post<MessageResponse>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) =>
    api.post<MessageResponse>('/auth/reset-password', { token, password }),

  verifyEmail: (token: string) => api.post<MessageResponse>('/auth/verify-email', { token }),

  me: () => api.get<AuthUser>('/auth/me'),
};

async function handleAuthResponse(res: Response): Promise<AuthResponse> {
  const json = (await res.json()) as {
    success: boolean;
    data?: AuthResponse;
    error?: { code: string; message: string };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new AuthClientError(json.error?.code ?? 'UNKNOWN', json.error?.message ?? 'Auth failed');
  }
  return json.data;
}

async function handleMessageResponse(res: Response): Promise<MessageResponse> {
  const json = (await res.json()) as { success: boolean; data?: MessageResponse };
  return json.data ?? { message: '' };
}

export class AuthClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
