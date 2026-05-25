/**
 * Integration test setup — points Prisma at TEST_DATABASE_URL and Redis at
 * REDIS_URL. CI starts a postgres + redis service in docker; locally pnpm
 * `docker compose up -d` covers both.
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '../../../.env') });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Copy .env.example to .env and ensure the test DB exists.',
  );
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ?? 'test_jwt_secret_64_chars_minimum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
