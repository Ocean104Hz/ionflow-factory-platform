import "server-only";
import { BackendError, readDatabaseConfig } from "./config.ts";
import {
  getDevelopmentDatabase,
  type DevelopmentDatabase,
} from "./database.ts";

export async function verifyDevelopmentDatabase(
  database?: DevelopmentDatabase,
): Promise<{ ok: true }> {
  const config = readDatabaseConfig();
  const db = database ?? getDevelopmentDatabase();
  return db.readOnly(async (tx) => {
    const rows = await tx.query(
      `SELECT
      current_database() = $1 AS database_ok,
      pg_catalog.to_regnamespace($2) IS NOT NULL AS schema_ok,
      pg_catalog.has_schema_privilege(current_user, pg_catalog.to_regnamespace($2), 'USAGE') AS schema_usage_ok,
      (current_user <> 'postgres' AND NOT r.rolsuper AND NOT r.rolcreatedb
        AND NOT r.rolcreaterole AND NOT r.rolreplication AND NOT r.rolbypassrls
        AND NOT pg_catalog.has_schema_privilege(current_user, pg_catalog.to_regnamespace($2), 'CREATE')
        AND NOT pg_catalog.has_database_privilege(current_user, current_database(), 'CREATE')) AS role_ok
      FROM pg_catalog.pg_roles r WHERE r.rolname = current_user`,
      [config.database, config.schema],
    );
    const row = rows[0];
    if (
      rows.length !== 1 ||
      !row ||
      row.database_ok !== true ||
      row.schema_ok !== true ||
      row.schema_usage_ok !== true ||
      row.role_ok !== true
    )
      throw new BackendError("DB_VERIFICATION_FAILED");
    return { ok: true };
  });
}
