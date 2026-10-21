-- PREPARED / NOT APPLIED. Requires separate explicit approval before execution.
-- inventory_sandbox must already exist with approved migration-role ownership.
BEGIN;

CREATE TABLE inventory_sandbox.schema_migrations (
  version TEXT PRIMARY KEY CHECK (version ~ '^[0-9]{4}_[a-z0-9_]+$'),
  checksum_sha256 TEXT NOT NULL CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_by TEXT NOT NULL DEFAULT CURRENT_USER CHECK (BTRIM(applied_by) <> '')
);

COMMENT ON TABLE inventory_sandbox.schema_migrations IS
  'Factory-owned development migration ledger; not an application user or business audit table';

COMMIT;
