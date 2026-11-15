// Regression controls for scripts/ci-check-test-results.mjs, run with Node's built-in runner:
//   node --test scripts/*.test.mjs
//
// The checker is what stops a green CI run that never ran its tests. These controls use small
// synthetic Vitest reports, so they prove the checker's decisions. They are not application test
// results. Each failure case asserts the specific reason, not just a nonzero exit, because a crash
// also exits nonzero and would otherwise pass for the wrong reason.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const checker = join(scriptDir, "ci-check-test-results.mjs");
const packages = readdirSync(join(repoRoot, "packages"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const workDir = mkdtempSync(join(tmpdir(), "ci-check-"));
after(() => rmSync(workDir, { recursive: true, force: true }));

/** A Vitest-shaped JSON report with one test file per package. */
function report({ status = "passed", skipPackage, failedCount = 0, pendingCount = 0 } = {}) {
  const testResults = packages
    .filter((name) => name !== skipPackage)
    .map((name) => ({
      name: `/work/packages/${name}/src/example.test.ts`,
      assertionResults: [{ status }],
    }));
  const total = testResults.length;
  return {
    numTotalTests: total,
    numPassedTests: status === "passed" ? total : 0,
    numFailedTests: failedCount,
    numPendingTests: pendingCount,
    numTodoTests: 0,
    success: failedCount === 0,
    testResults,
  };
}

const coverage = { total: { statements: { pct: 96 }, branches: { pct: 92 }, functions: { pct: 98 }, lines: { pct: 96 } } };

let counter = 0;
/** Writes a file with a unique name and returns its path. */
function write(content) {
  counter += 1;
  const path = join(workDir, `file-${counter}.json`);
  writeFileSync(path, typeof content === "string" ? content : JSON.stringify(content));
  return path;
}

/** Runs the checker from the repository root, as CI does. */
function run({ results, coveragePath = write(coverage), env = { TEST_DATABASE_URL: "postgres://example.test/db" } }) {
  const child = spawnSync(process.execPath, [checker, results, coveragePath], {
    cwd: repoRoot,
    env: { PATH: process.env.PATH, ...env },
    encoding: "utf8",
  });
  return { code: child.status, output: `${child.stdout}${child.stderr}` };
}

describe("ci-check-test-results", () => {
  it("passes a complete report with coverage and a database URL", () => {
    const { code, output } = run({ results: write(report()) });
    assert.equal(code, 0, output);
    assert.match(output, /every test ran and passed/);
  });

  it("FAILS, with a clear message and no crash, when the report is missing", () => {
    const { code, output } = run({ results: join(workDir, "does-not-exist.json") });
    assert.equal(code, 1);
    assert.match(output, /no test report at /);
    assert.doesNotMatch(output, /ENOENT|at readFileSync|node:internal/, "must be a handled failure, not a crash");
  });

  it("fails when the report is empty", () => {
    const { code, output } = run({ results: write("") });
    assert.equal(code, 1);
    assert.match(output, /not valid JSON/);
  });

  it("fails when the report is valid JSON but not a Vitest report", () => {
    const { code, output } = run({ results: write({ hello: "world" }) });
    assert.equal(code, 1);
    assert.match(output, /not a Vitest JSON report/);
  });

  it("fails when any test was skipped, even though Vitest itself would exit 0", () => {
    const { code, output } = run({ results: write(report({ status: "skipped", pendingCount: 3 })) });
    assert.equal(code, 1);
    assert.match(output, /skipped or todo tests/);
  });

  it("fails when a test failed", () => {
    const { code, output } = run({ results: write(report({ status: "failed", failedCount: 1 })) });
    assert.equal(code, 1);
    assert.match(output, /1 failed tests/);
  });

  it("fails when a package ran no tests", () => {
    const { code, output } = run({ results: write(report({ skipPackage: packages[0] })) });
    assert.equal(code, 1);
    assert.match(output, new RegExp(`package "${packages[0]}" ran no tests`));
  });

  it("fails when TEST_DATABASE_URL is not set", () => {
    const { code, output } = run({ results: write(report()), env: {} });
    assert.equal(code, 1);
    assert.match(output, /TEST_DATABASE_URL is not set/);
  });

  it("fails when the coverage summary is missing", () => {
    const { code, output } = run({ results: write(report()), coveragePath: join(workDir, "no-coverage.json") });
    assert.equal(code, 1);
    assert.match(output, /no coverage summary/);
  });
});
