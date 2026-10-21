-- Local Bulk documents only; no shared Production Orders storage or master-data FKs.
BEGIN;
DO $$ BEGIN
  IF current_database()<>'ionflow_inventory_dev' OR inet_server_port()<>5432
    OR inet_server_addr() IS NULL OR inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet)
    OR to_regnamespace('inventory_sandbox') IS NULL
    OR current_user IN ('factory_readonly','factory_settings_writer','factory_production_writer','factory_bulk_writer') THEN
    RAISE EXCEPTION 'Bulk migration target rejected';
  END IF;
END $$;
CREATE TABLE inventory_sandbox.bulk_production_orders (
  id TEXT PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{1,100}$'),
  doc_no TEXT NOT NULL CHECK(length(btrim(doc_no)) BETWEEN 1 AND 200),
  payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMPTZ,
  CHECK(payload->>'id' IS NOT NULL AND payload->>'id'=id),
  CHECK(payload->'header'->>'docNo' IS NOT NULL AND payload->'header'->>'docNo'=doc_no),
  CHECK(jsonb_typeof(payload->'rows')='array' AND jsonb_array_length(payload->'rows') BETWEEN 1 AND 200)
);
CREATE UNIQUE INDEX bulk_production_number ON inventory_sandbox.bulk_production_orders(lower(btrim(doc_no)));
CREATE INDEX bulk_production_recent ON inventory_sandbox.bulk_production_orders(updated_at DESC) WHERE archived_at IS NULL;
COMMIT;
