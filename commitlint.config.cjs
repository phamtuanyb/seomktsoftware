/**
 * Section 15 — Conventional Commits.
 * Allowed types: feat, fix, docs, refactor, test, chore, perf, build, ci, style, revert.
 * Scope is required and should reference the module (auth, keywords, content, ...) or area (db, ci, ui).
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'perf', 'build', 'ci', 'style', 'revert'],
    ],
    'scope-empty': [2, 'never'],
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
  },
};
