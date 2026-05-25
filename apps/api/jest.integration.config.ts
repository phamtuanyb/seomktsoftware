import type { Config } from 'jest';

/** Integration tests — needs Postgres (TEST_DATABASE_URL) + Redis. Run serially. */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup-integration.ts'],
  testTimeout: 30000,
};

export default config;
