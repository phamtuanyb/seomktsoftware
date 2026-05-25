/** Unit test setup — no external services. */
// Silence Pino during unit tests by default.
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.NODE_ENV = 'test';
