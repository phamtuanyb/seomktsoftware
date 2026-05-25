/**
 * ESLint preset for Next.js (apps/web).
 * Combines our base rules with next/core-web-vitals.
 */
module.exports = {
  root: false,
  extends: [
    'next/core-web-vitals',
    'next/typescript',
    'prettier',
  ],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/no-unescaped-entities': 'off',
  },
  ignorePatterns: ['dist/', 'build/', '.next/', 'coverage/', 'node_modules/'],
};
