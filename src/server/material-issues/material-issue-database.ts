import "server-only";

import { Pool } from "pg";

const DATABASE_NAME = "production";
const DATABASE_SCHEMA = "foliar_fertilizer";
const DATABASE_USER = "foliar_fertilizer_app";

type DatabaseErrorCode =
    | "DB_DISABLED"
    | "DB_CONFIG_INVALID"
    | "DB_UNAVAILABLE"
    | "DB_VERIFICATION_FAILED";

export class MaterialIssueDatabaseError extends Error {
    readonly code: DatabaseErrorCode;

    constructor(code: DatabaseErrorCode) {
        super(code);
        this.name = "MaterialIssueDatabaseError";
        this.code = code;
    }
}

function readConfig() {
    if (process.env.FACTORY_DB_ENABLED !== "true") {
        throw new MaterialIssueDatabaseError("DB_DISABLED");
    }

    const password = process.env.FACTORY_DB_PASSWORD;

    if (
        process.env.NODE_ENV === "production" ||
        process.env.FACTORY_DB_HOST !== "127.0.0.1" ||
        process.env.FACTORY_DB_PORT !== "5433" ||
        process.env.FACTORY_DB_NAME !== DATABASE_NAME ||
        process.env.FACTORY_DB_SCHEMA !== DATABASE_SCHEMA ||
        process.env.FACTORY_DB_USER !== DATABASE_USER ||
        !password ||
        password.includes("\0")
    ) {
        throw new MaterialIssueDatabaseError(
            "DB_CONFIG_INVALID",
        );
    }

    return {
        host: "127.0.0.1",
        port: 5433,
        database: DATABASE_NAME,
        user: DATABASE_USER,
        password,
        max: 3,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
        statement_timeout: 5000,
        query_timeout: 6000,
        lock_timeout: 5000,
        application_name: "nan-material-issues",
        ssl: false,
        options:
            "-c search_path=pg_catalog " +
            "-c default_transaction_read_only=on",
    };
}

const cache = globalThis as typeof globalThis & {
    materialIssuePool?: Pool;
};

function getPool(): Pool {
    const config = readConfig();

    if (!cache.materialIssuePool) {
        const pool = new Pool(config);

        pool.on("error", () => {
            console.error(
                "MATERIAL_ISSUE_DB_IDLE_CONNECTION_FAILED",
            );
        });

        cache.materialIssuePool = pool;
    }

    return cache.materialIssuePool;
}

interface VerificationRow {
    database_name: string;
    connected_user: string;
    schema_exists: boolean;
    can_use_schema: boolean;
    can_create_schema_objects: boolean;
    safe_role: boolean;
    owns_schema: boolean;
    owns_database: boolean;
    can_create_database_objects: boolean;
    owns_tables: boolean;
    tables_exist: boolean;
}

export async function verifyMaterialIssueDatabase(): Promise<void> {
    const pool = getPool();

    let client;

    try {
        client = await pool.connect();
    } catch {
        throw new MaterialIssueDatabaseError("DB_UNAVAILABLE");
    }

    let destroy = false;

    try {
        await client.query("BEGIN READ ONLY");

        const result = await client.query<VerificationRow>(
            `
      SELECT
        current_database()::text AS database_name,
        current_user::text AS connected_user,

        EXISTS (
          SELECT 1
          FROM pg_namespace
          WHERE nspname = $1
        ) AS schema_exists,

        has_schema_privilege(
          current_user,
          $1,
          'USAGE'
        ) AS can_use_schema,

        has_schema_privilege(
          current_user,
          $1,
          'CREATE'
        ) AS can_create_schema_objects,

        EXISTS (
          SELECT 1
          FROM pg_roles
          WHERE rolname = current_user
            AND NOT rolsuper
            AND NOT rolcreatedb
            AND NOT rolcreaterole
            AND NOT rolreplication
            AND NOT rolbypassrls
        ) AS safe_role,

        EXISTS (
          SELECT 1
          FROM pg_namespace
          WHERE nspname = $1
            AND nspowner = (
              SELECT oid
              FROM pg_roles
              WHERE rolname = current_user
            )
        ) AS owns_schema,

        EXISTS (
          SELECT 1
          FROM pg_database
          WHERE datname = current_database()
            AND datdba = (
              SELECT oid
              FROM pg_roles
              WHERE rolname = current_user
            )
        ) AS owns_database,

        has_database_privilege(
          current_user,
          current_database(),
          'CREATE'
        ) AS can_create_database_objects,

        EXISTS (
          SELECT 1
          FROM pg_tables
          WHERE schemaname = $1
            AND tablename IN (
              'm_material_issues',
              'r_material_issue_items',
              'r_material_issue_history'
            )
            AND tableowner = current_user
        ) AS owns_tables,

        (
          SELECT count(*) = 3
          FROM pg_tables
          WHERE schemaname = $1
            AND tablename IN (
              'm_material_issues',
              'r_material_issue_items',
              'r_material_issue_history'
            )
        ) AS tables_exist
      `,
            [DATABASE_SCHEMA],
        );

        const row = result.rows[0];

        if (
            !row ||
            row.database_name !== DATABASE_NAME ||
            row.connected_user !== DATABASE_USER ||
            !row.schema_exists ||
            !row.can_use_schema ||
            row.can_create_schema_objects ||
            !row.safe_role ||
            row.owns_schema ||
            row.owns_database ||
            row.can_create_database_objects ||
            row.owns_tables ||
            !row.tables_exist
        ) {
            throw new MaterialIssueDatabaseError(
                "DB_VERIFICATION_FAILED",
            );
        }

        await client.query("COMMIT");
    } catch {
        try {
            await client.query("ROLLBACK");
        } catch {
            destroy = true;
        }

        throw new MaterialIssueDatabaseError(
            "DB_VERIFICATION_FAILED",
        );
    } finally {
        client.release(destroy);
    }
}

export async function closeMaterialIssueDatabase(): Promise<void> {
    const pool = cache.materialIssuePool;

    delete cache.materialIssuePool;

    if (pool) {
        await pool.end();
    }
}
export type MaterialIssueSqlValue =
    | string
    | number
    | boolean
    | Date
    | null;

export interface MaterialIssueQueryResult<
    T extends Record<string, unknown>,
> {
    rows: T[];
    rowCount: number | null;
}

export interface MaterialIssueQueries {
    query<T extends Record<string, unknown>>(
        text: string,
        values?: readonly MaterialIssueSqlValue[],
    ): Promise<MaterialIssueQueryResult<T>>;
}

export async function withMaterialIssueReadTransaction<T>(
    work: (queries: MaterialIssueQueries) => Promise<T>,
): Promise<T> {
    const pool = getPool();

    const client = await pool.connect().catch(() => {
        throw new MaterialIssueDatabaseError("DB_UNAVAILABLE");
    });

    let destroy = false;
    let active = true;

    try {
        await client.query(
            "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
        );

        await client.query(
            "SET LOCAL search_path TO pg_catalog",
        );

        const identity = await client.query<{
            valid: boolean;
        }>(`
      SELECT (
        current_database() = 'production'
        AND current_user = 'foliar_fertilizer_app'
        AND has_schema_privilege(
          current_user,
          'foliar_fertilizer',
          'USAGE'
        )
        AND NOT has_schema_privilege(
          current_user,
          'foliar_fertilizer',
          'CREATE'
        )
      ) AS valid
    `);

        if (identity.rows[0]?.valid !== true) {
            throw new MaterialIssueDatabaseError(
                "DB_VERIFICATION_FAILED",
            );
        }

        const result = await work({
            async query<
                R extends Record<string, unknown>,
            >(
                text: string,
                values: readonly MaterialIssueSqlValue[] = [],
            ): Promise<MaterialIssueQueryResult<R>> {
                if (!active) {
                    throw new MaterialIssueDatabaseError(
                        "DB_VERIFICATION_FAILED",
                    );
                }

                const response = await client.query<R>(
                    text,
                    [...values],
                );

                return {
                    rows: response.rows,
                    rowCount: response.rowCount,
                };
            },
        });

        active = false;

        await client.query("COMMIT");

        return result;
    } catch (error: unknown) {
        active = false;

        try {
            await client.query("ROLLBACK");
        } catch {
            destroy = true;
        }

        if (error instanceof MaterialIssueDatabaseError) {
            throw error;
        }

        throw new MaterialIssueDatabaseError(
            "DB_VERIFICATION_FAILED",
        );
    } finally {
        active = false;
        client.release(destroy);
    }
}