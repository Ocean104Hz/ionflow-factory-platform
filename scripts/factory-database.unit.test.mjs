import test from "node:test";
import assert from "node:assert/strict";

import {
  createDevelopmentDatabase,
} from "../src/server/database/database.ts";

const config = {
  host: "127.0.0.1",
  port: 5433,
  database: "production",
  schema: "foliar_fertilizer",
  user: "foliar_fertilizer_app",
  password: "unit-test-only",
  max: 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 10000,
  statementTimeoutMillis: 5000,
};

function setup(options = {}) {
  const calls = [];
  const releases = [];

  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });

      if (sql.includes("AS valid")) {
        return {
          rows: [{ valid: options.valid !== false }],
        };
      }

      if (sql === options.failSql) {
        throw new Error("Mock query failure");
      }

      if (sql === "ROLLBACK" && options.failRollback) {
        throw new Error("Mock rollback failure");
      }

      return { rows: [{ value: 1 }] };
    },

    release(destroy = false) {
      releases.push(destroy);
    },
  };

  const db = createDevelopmentDatabase(config, () => ({
    async connect() {
      if (options.failConnect) {
        throw new Error("Mock connection failure");
      }

      return client;
    },

    async end() {},

    on() {},
  }));

  return { db, calls, releases };
}

test("readOnly keeps the original transaction behavior", async () => {
  const { db, calls, releases } = setup();

  await db.query("SELECT 1");

  assert.equal(calls[0].sql, "BEGIN READ ONLY");
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.deepEqual(releases, [false]);
});

test("write verifies the database before executing queries", async () => {
  const { db, calls, releases } = setup();

  const result = await db.write(async (tx) => {
    return tx.query("SELECT $1 AS value", [1]);
  });

  assert.equal(calls[0].sql, "BEGIN READ WRITE");
  assert.ok(calls[2].sql.includes("AS valid"));
  assert.deepEqual(calls[2].values, [
    "production",
    "foliar_fertilizer_app",
    "foliar_fertilizer",
  ]);

  assert.deepEqual(calls[3].values, [1]);
  assert.equal(calls.at(-1).sql, "COMMIT");
  assert.deepEqual(result, [{ value: 1 }]);
  assert.deepEqual(releases, [false]);
});

test("write rejects an invalid database or runtime role", async () => {
  const { db, calls } = setup({ valid: false });

  let executed = false;

  await assert.rejects(
    db.write(async () => {
      executed = true;
    }),
    { code: "DB_VERIFICATION_FAILED" },
  );

  assert.equal(executed, false);
  assert.equal(calls.at(-1).sql, "ROLLBACK");
});

test("write rolls back when the operation fails", async () => {
  const { db, calls, releases } = setup();

  await assert.rejects(
    db.write(async () => {
      throw new Error("Operation failed");
    }),
    /Operation failed/,
  );

  assert.equal(calls.at(-1).sql, "ROLLBACK");
  assert.deepEqual(releases, [false]);
});

test("write rolls back when a query fails", async () => {
  const { db, calls } = setup({
    failSql: "SELECT 1",
  });

  await assert.rejects(
    db.write((tx) => tx.query("SELECT 1")),
    /Mock query failure/,
  );

  assert.equal(calls.at(-1).sql, "ROLLBACK");
});

test("write destroys the connection if rollback fails", async () => {
  const { db, releases } = setup({
    failRollback: true,
  });

  await assert.rejects(
    db.write(async () => {
      throw new Error("Operation failed");
    }),
  );

  assert.deepEqual(releases, [true]);
});

test("write reports a failed commit", async () => {
  const { db, calls } = setup({
    failSql: "COMMIT",
  });

  await assert.rejects(
    db.write((tx) => tx.query("SELECT 1")),
    { code: "DB_TRANSACTION_FAILED" },
  );

  assert.equal(calls.at(-1).sql, "ROLLBACK");
});

test("write rejects queries after the transaction ends", async () => {
  const { db } = setup();

  const queries = await db.write(async (tx) => tx);

  await assert.rejects(
    queries.query("SELECT 1"),
    { code: "DB_QUERY_FAILED" },
  );
});

test("write handles connection failure", async () => {
  const { db } = setup({ failConnect: true });

  await assert.rejects(
    db.write(async () => undefined),
    { code: "DB_UNAVAILABLE" },
  );
});