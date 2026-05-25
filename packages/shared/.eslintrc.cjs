/**
 * Inherit base ESLint config from @mkt-seo/config.
 */
const base = require('@mkt-seo/config/eslint-base.cjs');

module.exports = {
  root: true,
  ...base,
  parserOptions: {
    ...base.parserOptions,
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
};
