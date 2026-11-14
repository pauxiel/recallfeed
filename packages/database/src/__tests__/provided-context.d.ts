import type { MigrationReport } from "../migrate";

// Values the Node-side global setup hands to the Workers-runtime tests.
declare module "vitest" {
  export interface ProvidedContext {
    /** Reports of two consecutive migration runs against a freshly reset schema; empty when skipped. */
    migrationRuns: { first: MigrationReport; second: MigrationReport } | null;
  }
}
