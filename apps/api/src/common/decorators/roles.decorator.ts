import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@mkt-seo/shared';

export const ROLES_KEY = 'roles';
/** Section 9 — RBAC. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
