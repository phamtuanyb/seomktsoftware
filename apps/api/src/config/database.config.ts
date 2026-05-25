import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  testUrl: process.env.TEST_DATABASE_URL ?? '',
}));
