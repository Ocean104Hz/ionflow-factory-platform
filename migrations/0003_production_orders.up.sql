-- PREPARED / NOT APPLIED. Only an approved local migration owner may execute.
BEGIN;
DO $$ BEGIN
  IF current_database()<>'ionflow_inventory_dev' OR inet_server_port()<>5432
    OR inet_server_addr() IS NULL OR inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet)
    OR to_regnamespace('inventory_sandbox') IS NULL
    OR current_user IN ('factory_readonly','factory_settings_writer','factory_production_writer') THEN
    RAISE EXCEPTION 'Production Orders migration target rejected';
  END IF;
END $$;
CREATE TABLE inventory_sandbox.production_orders (
  id TEXT PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{1,100}$'),
  source TEXT NOT NULL CHECK(source IN ('Sales Hub','Datalink')),
  number TEXT NOT NULL CHECK(length(btrim(number)) BETWEEN 1 AND 100),
  company TEXT NOT NULL CHECK(length(btrim(company)) BETWEEN 1 AND 200),
  payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  UNIQUE(source, company, number),
  CHECK(payload->>'id' IS NOT NULL AND payload->>'id'=id),
  CHECK(payload->>'source' IS NOT NULL AND payload->>'source'=source),
  CHECK(payload->>'number' IS NOT NULL AND payload->>'number'=number),
  CHECK(payload->>'company' IS NOT NULL AND payload->>'company'=company)
);
CREATE TABLE inventory_sandbox.production_order_history (
  order_id TEXT NOT NULL REFERENCES inventory_sandbox.production_orders(id) ON DELETE RESTRICT,
  record_version BIGINT NOT NULL CHECK(record_version>0),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  actor TEXT NOT NULL CHECK(actor='LOCAL_DEVELOPMENT'),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(order_id, record_version)
);
CREATE INDEX production_orders_recent ON inventory_sandbox.production_orders(updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX production_order_history_order ON inventory_sandbox.production_order_history(order_id,record_version);
COMMIT;
