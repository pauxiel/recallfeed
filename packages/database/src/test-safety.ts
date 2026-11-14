import { ValidationError } from "@recallfeed/core";

/** Hosts a disposable test database may live on: this machine's loopback interface only. */
const SAFE_TEST_HOSTS: ReadonlySet<string> = new Set([
  "db.localtest.me",
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

/** The database name must contain `test` as a whole word, such as `recallfeed_test`. */
const TEST_DATABASE_NAME = /(^|[_-])test($|[_-])/;

/**
 * Refuses to continue unless the URL points at a local, clearly named test database.
 *
 * The integration test setup drops and recreates the `public` schema, so this guard
 * is the only thing that stops a mistyped `TEST_DATABASE_URL` from wiping a real
 * database. It never puts the full URL in an error, because the URL carries a password.
 *
 * @param databaseUrl - The value of `TEST_DATABASE_URL`.
 * @throws ValidationError if the scheme, host, or database name is not safe.
 */
export function assertSafeTestDatabaseUrl(databaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new ValidationError(
      "TEST_DATABASE_URL is not a valid URL.",
      "VALIDATION_TEST_DATABASE_URL",
    );
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new ValidationError(
      "TEST_DATABASE_URL must use the postgres:// or postgresql:// scheme.",
      "VALIDATION_TEST_DATABASE_URL",
    );
  }
  if (!SAFE_TEST_HOSTS.has(url.hostname)) {
    throw new ValidationError(
      `Refusing to use test database host "${url.hostname}". Allowed hosts: ${[...SAFE_TEST_HOSTS].join(", ")}.`,
      "VALIDATION_TEST_DATABASE_HOST",
    );
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!TEST_DATABASE_NAME.test(databaseName)) {
    throw new ValidationError(
      `Refusing to use database "${databaseName}": the name must contain "test" as a whole word.`,
      "VALIDATION_TEST_DATABASE_NAME",
    );
  }
}
