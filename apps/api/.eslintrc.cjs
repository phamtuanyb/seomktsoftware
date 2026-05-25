const base = require('@mkt-seo/config/eslint-node.cjs');

module.exports = {
  root: true,
  ...base,
  // No `project` option — skip typed linting for speed (still strict typing via tsc).
  parserOptions: {
    ...base.parserOptions,
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: [...(base.ignorePatterns ?? []), 'dist/', 'jest.*.config.ts'],
};
