import { ValidationError } from "@recallfeed/core";

/** The only database name the disposable fixture uses. A look-alike name is not enough. */
export const FIXTURE_DATABASE = "recallfeed_test";

/** Hosts a disposable test database may live on: this machine's loopback interface only. */
const SAFE_TEST_HOSTS: ReadonlySet<string> = new Set([
  "db.localtest.me",
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

function invalid(message: string, code: string): ValidationError {
  // Messages never include the full URL, because it carries a password.
  return new ValidationError(message, code);
}

/**
 * First gate for the destructive test setup: refuses a URL that is not exactly the local
 * disposable fixture.
 *
 * The setup drops and recreates the `public` schema, so a mistyped `TEST_DATABASE_URL`
 * must never get that far. This checks the URL as written. The later gates
 * ({@link assertDriverTargetMatchesUrl} and the fixture marker check) check what the
 * driver and the server actually report.
 *
 * Query parameters and fragments are rejected outright because the Neon driver lets
 * `?host=` override the host in the URL, which would send the reset somewhere the host
 * check never looked.
 *
 * @param databaseUrl - The value of `TEST_DATABASE_URL`.
 * @throws ValidationError if the scheme, host, database name, or extras are not allowed.
 */
export function assertSafeTestDatabaseUrl(databaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw invalid("TEST_DATABASE_URL is not a valid URL.", "VALIDATION_TEST_DATABASE_URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw invalid(
      "TEST_DATABASE_URL must use the postgres:// or postgresql:// scheme.",
      "VALIDATION_TEST_DATABASE_URL",
    );
  }
  // Judge the raw string: the URL parser drops an empty `?`, but any query part at all means
  // the caller expects parameters to apply, and the driver reads them.
  if (databaseUrl.includes("?") || databaseUrl.includes("#") || url.search !== "" || url.hash !== "") {
    throw invalid(
      "TEST_DATABASE_URL must not contain query parameters or a fragment; they can override the host.",
      "VALIDATION_TEST_DATABASE_PARAMS",
    );
  }
  if (!SAFE_TEST_HOSTS.has(url.hostname)) {
    throw invalid(
      `Refusing to use test database host "${url.hostname}". Allowed hosts: ${[...SAFE_TEST_HOSTS].join(", ")}.`,
      "VALIDATION_TEST_DATABASE_HOST",
    );
  }
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (databaseName !== FIXTURE_DATABASE) {
    throw invalid(
      `Refusing to use database "${databaseName}": the disposable fixture is named "${FIXTURE_DATABASE}".`,
      "VALIDATION_TEST_DATABASE_NAME",
    );
  }
}

/** The connection target a Neon `Client` resolved from a connection string. */
export type DriverTarget = {
  host: string;
  port: number;
  database?: string | undefined;
};

const stripBrackets = (host: string): string => host.replace(/^\[|\]$/g, "");

/**
 * Second gate: confirms the driver will connect to the host, port, and database the URL
 * shows.
 *
 * `assertSafeTestDatabaseUrl` reads the URL with the WHATWG parser, while the driver uses
 * its own parser. If the two disagree, the safe-looking URL is not what will be used.
 *
 * @param target - The `host`, `port`, and `database` of a constructed, unconnected `Client`.
 * @param databaseUrl - The same URL the client was built from.
 * @throws ValidationError if the driver's effective target differs from the URL.
 */
export function assertDriverTargetMatchesUrl(target: DriverTarget, databaseUrl: string): void {
  const url = new URL(databaseUrl);
  const expected = {
    host: stripBrackets(url.hostname),
    port: url.port === "" ? 5432 : Number(url.port),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
  };
  const actual = {
    host: stripBrackets(target.host),
    port: target.port,
    database: target.database,
  };
  if (
    actual.host !== expected.host ||
    actual.port !== expected.port ||
    actual.database !== expected.database
  ) {
    throw invalid(
      `The database driver would connect to "${actual.host}:${actual.port}/${actual.database ?? ""}", ` +
        `not the target in TEST_DATABASE_URL. Nothing was connected.`,
      "VALIDATION_TEST_DATABASE_TARGET",
    );
  }
}
