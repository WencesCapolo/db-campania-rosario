/**
 * The one place the test database URL is decided.
 *
 * Imported by vitest.config.ts, which sets it as DATABASE_URL for the suite,
 * and by the harness itself. Not a secret: it points at a throwaway local
 * container, never at Neon. Override with TEST_DATABASE_URL in CI.
 *
 * See docs/TESTING.md for how to start the container.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:55432/campania_test";
