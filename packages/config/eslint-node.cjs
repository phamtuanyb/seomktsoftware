/**
 * ESLint preset for NestJS / Node-side packages.
 * Loosens some rules that are noisy in decorator-heavy NestJS code.
 */
const base = require('./eslint-base.cjs');

module.exports = {
  ...base,
  env: { ...base.env, jest: true },
  rules: {
    ...base.rules,
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  overrides: [
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
};
