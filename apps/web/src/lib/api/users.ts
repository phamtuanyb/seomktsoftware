import { api } from './client';

export interface UserSubscription {
  plan: string;
  status: string;
  expires_at: string | null;
}

export interface UserQuota {
  resource: string;
  period: string;
  limit_value: number;
  used: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  plan: string;
  email_verified: boolean;
  preferences_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  subscription: UserSubscription | null;
  quotas: UserQuota[];
}

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  avatar_url?: string;
  preferences_json?: Record<string, unknown>;
}

/** Section 6 — /users/me (full profile + subscription + quotas). */
export const usersApi = {
  me: () => api.get<UserProfile>('/users/me'),
  update: (body: UpdateProfileRequest) => api.patch<UserProfile>('/users/me', body),
};
