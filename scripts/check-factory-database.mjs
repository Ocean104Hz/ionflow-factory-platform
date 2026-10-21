// Local diagnostic only. No schema creation, migrations, grants or business writes.
if (process.env.NODE_ENV === "production") {
  console.error("NOT RUN: development diagnostic is disabled in production.");
  process.exitCode = 1;
} else {
  let close;
  try {
    const { verifyDevelopmentDatabase } =
      await import("../src/server/database/diagnostic.ts");
    close = (await import("../src/server/database/database.ts"))
      .closeDevelopmentDatabase;
    await verifyDevelopmentDatabase();
    console.log(
      "PASS: development connection, database, schema and application-role checks.",
    );
  } catch (error) {
    const allowed = new Set([
      "DB_DISABLED",
      "DB_CONFIG_INVALID",
      "DB_UNAVAILABLE",
      "DB_QUERY_FAILED",
      "DB_TRANSACTION_FAILED",
      "DB_VERIFICATION_FAILED",
    ]);
    const code =
      error &&
      typeof error === "object" &&
      "code" in error &&
      allowed.has(error.code)
        ? error.code
        : "DIAGNOSTIC_FAILED";
    console.error(
      `FAIL: ${code}. Check local configuration; raw connection details are suppressed.`,
    );
    process.exitCode = 1;
  } finally {
    try {
      await close?.();
    } catch {
      console.error("FAIL: DB_CLOSE_FAILED");
      process.exitCode = 1;
    }
  }
}
