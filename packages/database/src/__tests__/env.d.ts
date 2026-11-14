// Bindings that vitest.config.ts passes to the Workers test runtime.
declare namespace Cloudflare {
  interface Env {
    /** Connection string of the disposable test database. Empty when integration tests are skipped. */
    TEST_DATABASE_URL: string;
  }
}
