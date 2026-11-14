// Fails a CI run that is "green" without having run every test.
//
// Vitest exits 0 when tests are skipped, so a run with no database would pass while skipping
// every database-backed suite. This reads Vitest's JSON report and the coverage summary,
// prints the totals where a reviewer can see them, and exits 1 on any failed, skipped, todo,
// or missing test. It does not replace Vitest's own exit code or its coverage thresholds.
//
// Usage: node scripts/ci-check-test-results.mjs <vitest-results.json> [coverage-summary.json]
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const [resultsPath, coveragePath = "coverage/coverage-summary.json"] = process.argv.slice(2);
if (resultsPath === undefined) {
  console.error("usage: ci-check-test-results.mjs <vitest-results.json> [coverage-summary.json]");
  process.exit(2);
}

const results = JSON.parse(readFileSync(resultsPath, "utf8"));
const problems = [];

// Count files and tests per package from the file paths, so a package that silently stops
// contributing tests is caught even when the total still looks healthy.
const perPackage = new Map();
for (const file of results.testResults) {
  const match = /\/packages\/([^/]+)\//.exec(file.name);
  const name = match === null ? "(outside packages)" : match[1];
  const entry = perPackage.get(name) ?? { files: 0, tests: 0, skipped: 0, failed: 0 };
  entry.files += 1;
  for (const test of file.assertionResults) {
    entry.tests += 1;
    if (test.status === "failed") entry.failed += 1;
    else if (test.status !== "passed") entry.skipped += 1;
  }
  perPackage.set(name, entry);
}

const expectedPackages = readdirSync("packages", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
for (const name of expectedPackages) {
  const entry = perPackage.get(name);
  if (entry === undefined || entry.tests === 0) {
    problems.push(`package "${name}" ran no tests`);
  }
}

const skipped = (results.numPendingTests ?? 0) + (results.numTodoTests ?? 0);
if (results.numTotalTests === 0) problems.push("no tests ran");
if (results.numFailedTests > 0) problems.push(`${results.numFailedTests} failed tests`);
if (skipped > 0) {
  problems.push(
    `${skipped} skipped or todo tests. Database-backed suites skip when TEST_DATABASE_URL is unset or unreachable, ` +
      "so a skip here means the database was not used",
  );
}
if (results.success !== true) problems.push("Vitest reported success: false");
if (!process.env.TEST_DATABASE_URL) problems.push("TEST_DATABASE_URL is not set");

const lines = [];
lines.push("### Test results", "");
lines.push("| Package | Files | Tests | Skipped | Failed |", "|---|---:|---:|---:|---:|");
for (const [name, entry] of [...perPackage.entries()].sort()) {
  lines.push(`| ${name} | ${entry.files} | ${entry.tests} | ${entry.skipped} | ${entry.failed} |`);
}
lines.push(
  `| **total** | ${results.testResults.length} | ${results.numTotalTests} | ${skipped} | ${results.numFailedTests} |`,
  "",
);

if (existsSync(coveragePath)) {
  const total = JSON.parse(readFileSync(join(coveragePath), "utf8")).total;
  lines.push("### Coverage (threshold 80% for each)", "", "| Statements | Branches | Functions | Lines |", "|---:|---:|---:|---:|");
  lines.push(`| ${total.statements.pct}% | ${total.branches.pct}% | ${total.functions.pct}% | ${total.lines.pct}% |`, "");
} else {
  problems.push(`no coverage summary at ${coveragePath}`);
}

lines.push(problems.length === 0 ? "**Result: every test ran and passed.**" : "**Result: FAILED**");
for (const problem of problems) lines.push(`- ${problem}`);

const text = lines.join("\n");
console.log(text);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}
process.exit(problems.length === 0 ? 0 : 1);
