-- PREPARED / NOT APPLIED. Execute only as separately approved migration owner.
-- Target must be ionflow_inventory_dev / inventory_sandbox; never the application runtime role.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ionflow_inventory_dev'
     OR inet_server_port() <> 5432
     OR inet_server_addr() IS NULL
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR current_user IN ('factory_readonly', 'factory_settings_writer')
     OR to_regnamespace('inventory_sandbox') IS NULL THEN
    RAISE EXCEPTION 'Settings migration target rejected';
  END IF;
END $$;
CREATE TABLE inventory_sandbox.settings_masters (
  id TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{1,100}$'),
  kind TEXT NOT NULL CHECK (kind IN ('sites','areas','warehouses','departments','lines','shifts','vehicleTypes','vehicles','equipment','units','categories','brands','processes','suppliers')),
  code TEXT NOT NULL CHECK (code ~ '^[A-Z0-9_-]{1,30}$'),
  name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  parent_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  type_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (payload->>'id' IS NOT NULL AND payload->>'id'=id),
  CHECK (payload->>'kind' IS NOT NULL AND payload->>'kind'=kind),
  CHECK (payload->>'code' IS NOT NULL AND payload->>'code'=code),
  CHECK (payload->>'name' IS NOT NULL AND payload->>'name'=name),
  CHECK (jsonb_typeof(payload->'active') IS NOT NULL AND jsonb_typeof(payload->'active')='boolean'),
  CHECK (jsonb_typeof(payload->'aliases') IS NOT NULL AND jsonb_typeof(payload->'aliases')='array'),
  CHECK (COALESCE(payload->>'parentId','')=COALESCE(parent_id,'')),
  CHECK (COALESCE(payload->>'typeId','')=COALESCE(type_id,''))
);
CREATE UNIQUE INDEX settings_masters_code ON inventory_sandbox.settings_masters(kind, lower(code));
CREATE UNIQUE INDEX settings_masters_name ON inventory_sandbox.settings_masters(kind, lower(name));
CREATE INDEX settings_masters_parent ON inventory_sandbox.settings_masters(parent_id);
CREATE INDEX settings_masters_type ON inventory_sandbox.settings_masters(type_id);
COMMIT;
