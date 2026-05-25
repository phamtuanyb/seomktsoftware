import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SCOPE_KEY = 'requireScope';
/** Section 6 — API key scopes (Phase 2 ready). */
export const RequireScope = (...scopes: string[]) => SetMetadata(REQUIRE_SCOPE_KEY, scopes);
