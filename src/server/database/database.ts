import "server-only";
import { Pool, type PoolConfig } from "pg";
import {
  BackendError,
  readDatabaseConfig,
  type DatabaseConfig,
} from "./config.ts";

export type SqlValue = string | number | boolean | Date | null;
export type DatabaseRow = Record<string, unknown>;
interface DriverClient {
  query(text: string, values?: unknown[]): Promise<{ rows: DatabaseRow[] }>;
  release(destroy?: boolean): void;
}
export interface DatabasePool {
  connect(): Promise<DriverClient>;
  end(): Promise<void>;
  on(event: "error", listener: () => void): unknown;
}
export interface ReadOnlyQueries {
  query(text: string, values?: readonly SqlValue[]): Promise<DatabaseRow[]>;
}
export interface DevelopmentDatabase extends ReadOnlyQueries {
  readOnly<T>(work: (queries: ReadOnlyQueries) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export function createDevelopmentDatabase(
  config: DatabaseConfig,
  makePool: (options: PoolConfig) => DatabasePool = (options) =>
    new Pool(options),
): DevelopmentDatabase {
  // Revalidate caller-supplied config too: this Phase 1 utility must never target production.
  readDatabaseConfig({
    NODE_ENV: process.env.NODE_ENV,
    FACTORY_DB_ENABLED: "true",
    FACTORY_DB_HOST: config.host,
    FACTORY_DB_PORT: String(config.port),
    FACTORY_DB_NAME: config.database,
    FACTORY_DB_SCHEMA: config.schema,
    FACTORY_DB_USER: config.user,
    FACTORY_DB_PASSWORD: config.password,
    FACTORY_DB_POOL_MAX: String(config.max),
    FACTORY_DB_CONNECT_TIMEOUT_MS: String(config.connectionTimeoutMillis),
    FACTORY_DB_IDLE_TIMEOUT_MS: String(config.idleTimeoutMillis),
    FACTORY_DB_STATEMENT_TIMEOUT_MS: String(config.statementTimeoutMillis),
  });
  let pool: DatabasePool;
  try {
    pool = makePool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.max,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      idleTimeoutMillis: config.idleTimeoutMillis,
      statement_timeout: config.statementTimeoutMillis,
      query_timeout: config.statementTimeoutMillis + 1000,
      lock_timeout: config.statementTimeoutMillis,
      application_name: "ionflow-factory-development",
      ssl: false,
      options: "-c search_path=pg_catalog -c default_transaction_read_only=on",
    });
  } catch {
    throw new BackendError("DB_UNAVAILABLE");
  }
  pool.on("error", () => {
    console.error("FACTORY_DB_IDLE_CONNECTION_FAILED");
  });
  async function readOnly<T>(
    work: (queries: ReadOnlyQueries) => Promise<T>,
  ): Promise<T> {
    let client: DriverClient;
    try {
      client = await pool.connect();
    } catch {
      throw new BackendError("DB_UNAVAILABLE");
    }
    let destroy = false;
    let stage: "query" | "commit" = "query";
    let active = true;
    try {
      await client.query("BEGIN READ ONLY");
      await client.query(
        "SET LOCAL search_path TO pg_catalog, inventory_sandbox",
      );
      const result = await work({
        async query(text, values = []) {
          if (!active || !text.trim())
            throw new BackendError("DB_QUERY_FAILED");
          // SQL text is trusted server code only. All user values must be separate parameters.
          return (await client.query(text, [...values])).rows;
        },
      });
      stage = "commit";
      await client.query("COMMIT");
      return result;
    } catch (error: unknown) {
      try {
        await client.query("ROLLBACK");
      } catch {
        destroy = true;
      }
      if (error instanceof BackendError) throw error;
      throw new BackendError(
        stage === "commit" ? "DB_TRANSACTION_FAILED" : "DB_QUERY_FAILED",
      );
    } finally {
      active = false;
      try {
        client.release(destroy);
      } catch {
        throw new BackendError("DB_UNAVAILABLE");
      }
    }
  }
  return {
    readOnly,
    query: (text, values) => readOnly((q) => q.query(text, values)),
    async close() {
      try {
        await pool.end();
      } catch {
        throw new BackendError("DB_UNAVAILABLE");
      }
    },
  };
}

const cache = globalThis as typeof globalThis & {
  factoryDevelopmentDatabase?: DevelopmentDatabase;
};
export function getDevelopmentDatabase(): DevelopmentDatabase {
  const config = readDatabaseConfig();
  return (cache.factoryDevelopmentDatabase ??=
    createDevelopmentDatabase(config));
}
export async function closeDevelopmentDatabase() {
  const db = cache.factoryDevelopmentDatabase;
  delete cache.factoryDevelopmentDatabase;
  if (db) await db.close();
}
