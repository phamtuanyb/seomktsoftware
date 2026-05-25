/**
 * Re-export PrismaClient as the canonical entry point for app code.
 * NestJS PrismaService wraps this client. Section 7 schema lives under `prisma/`.
 */
export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';
