/**
 * Root ESLint config. Each package overrides via its own .eslintrc.cjs
 * extending @mkt-seo/config presets.
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: { es2022: true, node: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: [
    'dist/',
    'build/',
    '.next/',
    '.turbo/',
    'coverage/',
    'node_modules/',
    '*.cjs',
    '*.config.js',
    'pnpm-lock.yaml',
  ],
};
