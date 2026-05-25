import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Skip JwtAuthGuard for this endpoint (login, register, health, etc.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
