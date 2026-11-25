import {
  verifyMaterialIssueDatabase,
  closeMaterialIssueDatabase,
} from "../src/server/material-issues/material-issue-database.ts";

try {
  await verifyMaterialIssueDatabase();

  console.log(
    "PASS: Material Issues database connection.",
  );

  console.log(
    "PASS: All 3 Material Issues tables exist.",
  );

  console.log(
    "PASS: Application role verification.",
  );
} catch (error) {
  const allowed = new Set([
    "DB_DISABLED",
    "DB_CONFIG_INVALID",
    "DB_UNAVAILABLE",
    "DB_VERIFICATION_FAILED",
  ]);

  const code =
    error instanceof Error &&
    "code" in error &&
    allowed.has(error.code)
      ? error.code
      : "DIAGNOSTIC_FAILED";

  console.error(`FAIL: ${code}`);

  process.exitCode = 1;
} finally {
  try {
    await closeMaterialIssueDatabase();
  } catch {
    console.error("FAIL: DB_CLOSE_FAILED");
    process.exitCode = 1;
  }
}