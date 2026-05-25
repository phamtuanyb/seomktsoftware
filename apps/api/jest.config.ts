import type { Config } from 'jest';

/** Unit tests — co-located *.spec.ts next to source. Fast, no external services. */
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  preset: 'ts-jest',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/dto/**',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/**/__mocks__/**',
    // Skeleton modules whose only logic is throwing NotImplementedException —
    // pulled out until their corresponding sprint covers them.
    '!src/modules/users/**/*.controller.ts',
    '!src/modules/billing/**/*.controller.ts',
    '!src/modules/keywords/**/*.controller.ts',
    '!src/modules/content/**/*.controller.ts',
    '!src/modules/brand-voices/**/*.controller.ts',
    '!src/modules/images/**/*.controller.ts',
    '!src/modules/audit/**/*.controller.ts',
    '!src/modules/publisher/**/*.controller.ts',
    '!src/modules/webhooks/**/*.controller.ts',
    '!src/modules/plugins/**/*.controller.ts',
    '!src/app.controller.ts',
    // Controllers are covered by integration tests; unit coverage focuses on services.
    '!src/modules/auth/auth.controller.ts',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: { statements: 0, branches: 0, functions: 0, lines: 0 },
    './src/modules/auth/': { statements: 80, branches: 70, functions: 80, lines: 80 },
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup-unit.ts'],
};

export default config;
