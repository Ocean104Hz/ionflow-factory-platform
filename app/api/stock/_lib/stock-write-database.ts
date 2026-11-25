import "server-only";

import { Pool } from "pg";

import {
  BackendError,
  readDatabaseConfig,
} from "../../../../src/server/database/config.ts";

import type {
  DatabaseRow,
  SqlValue,
} from "../../../../src/server/database/database.ts";

export interface StockWriteQueries {
  query(
    sql: string,
    values?: readonly SqlValue[],
  ): Promise<DatabaseRow[]>;
}

interface StockWriteClient {
  query(
    sql: string,
    values?: SqlValue[],
  ): Promise<{ rows: DatabaseRow[] }>;
  release(destroy?: boolean): void;
}

interface StockWritePool {
  connect(): Promise<StockWriteClient>;
}

const cache = globalThis as typeof globalThis & {
  foliarStockWritePool?: Pool;
};

function getStockWritePool(): Pool {
  const config = readDatabaseConfig();

  if (cache.foliarStockWritePool) {
    return cache.foliarStockWritePool;
  }

  const pool = new Pool({
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
    application_name: "foliar-fertilizer-stock-write",
    ssl: false,
    options: "-c search_path=pg_catalog",
  });

  pool.on("error", () => {
    console.error("STOCK_WRITE_IDLE_CONNECTION_FAILED");
  });

  cache.foliarStockWritePool = pool;

  return pool;
}

// Internal server code only. Await every query inside the callback.
export async function runStockWriteTransaction<T>(
  pool: StockWritePool,
  work: (queries: StockWriteQueries) => Promise<T>,
): Promise<T> {
  let client: StockWriteClient;

  try {
    client = await pool.connect();
  } catch {
    throw new BackendError("DB_UNAVAILABLE");
  }

  let active = false;
  let queryFailed = false;
  let discard = false;
  let stage: "begin" | "work" | "commit" = "begin";

  try {
    await client.query("BEGIN READ WRITE");

    active = true;
    stage = "work";

    const result = await work({
      async query(sql, values = []) {
        if (!active || !sql.trim() || queryFailed) {
          throw new BackendError("DB_QUERY_FAILED");
        }

        try {
          return (await client.query(sql, [...values])).rows;
        } catch {
          queryFailed = true;
          throw new BackendError("DB_QUERY_FAILED");
        }
      },
    });

    active = false;

    if (queryFailed) {
      throw new BackendError("DB_QUERY_FAILED");
    }

    stage = "commit";

    await client.query("COMMIT");

    return result;
  } catch (error) {
    active = false;

    // Never retry an uncertain COMMIT automatically.
    discard = stage !== "work";

    try {
      await client.query("ROLLBACK");
    } catch {
      discard = true;
    }

    if (stage !== "work" || discard) {
      throw new BackendError("DB_TRANSACTION_FAILED");
    }

    throw error;
  } finally {
    active = false;
    client.release(discard);
  }
}

export async function withStockWriteTransaction<T>(
  work: (queries: StockWriteQueries) => Promise<T>,
): Promise<T> {
  return runStockWriteTransaction(getStockWritePool(), work);
}