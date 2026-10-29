-- PREPARED / NOT APPLIED. PR + PO only; requires separate migration approval.
BEGIN;
DO $$ BEGIN
  IF current_database()<>'ionflow_inventory_dev' OR inet_server_port()<>5432
    OR inet_server_addr() IS NULL OR inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet)
    OR to_regnamespace('inventory_sandbox') IS NULL
    OR current_user IN ('factory_readonly','factory_settings_writer','factory_production_writer','factory_auth_runtime','factory_purchasing_writer')
    OR to_regclass('inventory_sandbox.settings_masters') IS NULL THEN
    RAISE EXCEPTION 'Purchasing migration target rejected';
  END IF;
END $$;

CREATE TABLE inventory_sandbox.purchasing_prs (
  id TEXT PRIMARY KEY CHECK(id ~ '^pr-[A-Za-z0-9_-]{1,100}$'),
  document_number TEXT NOT NULL CHECK(length(btrim(document_number)) BETWEEN 1 AND 100),
  document_date DATE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','approved','rejected','cancelled','partial_po_created','fully_po_created','closed')),
  warehouse_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  header_payload JSONB NOT NULL CHECK(jsonb_typeof(header_payload)='object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX purchasing_pr_number ON inventory_sandbox.purchasing_prs(lower(document_number));

CREATE TABLE inventory_sandbox.purchasing_pr_items (
  id TEXT PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{1,100}$'),
  pr_id TEXT NOT NULL REFERENCES inventory_sandbox.purchasing_prs(id) ON DELETE RESTRICT,
  line_no INTEGER NOT NULL CHECK(line_no BETWEEN 1 AND 100),
  material_code_snapshot TEXT NOT NULL,
  material_name_snapshot TEXT NOT NULL,
  supplier_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  supplier_code_snapshot TEXT NOT NULL DEFAULT '',
  supplier_name_snapshot TEXT NOT NULL DEFAULT '',
  specification TEXT NOT NULL DEFAULT '',
  requested_quantity NUMERIC(18,4) NOT NULL CHECK(requested_quantity>0),
  unit_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  unit_snapshot TEXT NOT NULL,
  estimated_unit_price NUMERIC(18,2) CHECK(estimated_unit_price>=0),
  remarks TEXT NOT NULL DEFAULT '',
  UNIQUE(pr_id,line_no),
  UNIQUE(pr_id,id)
);

CREATE TABLE inventory_sandbox.purchasing_pr_history (
  id UUID PRIMARY KEY,
  pr_id TEXT NOT NULL REFERENCES inventory_sandbox.purchasing_prs(id) ON DELETE RESTRICT,
  record_version BIGINT NOT NULL CHECK(record_version>0),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL CHECK(length(btrim(actor_id)) BETWEEN 1 AND 200),
  actor_display_name TEXT NOT NULL CHECK(length(btrim(actor_display_name)) BETWEEN 1 AND 200),
  occurred_at TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  from_status TEXT,
  to_status TEXT NOT NULL,
  changes JSONB NOT NULL CHECK(jsonb_typeof(changes)='array'),
  request_id UUID UNIQUE,
  UNIQUE(pr_id,record_version,id)
);

CREATE TABLE inventory_sandbox.purchasing_pos (
  id TEXT PRIMARY KEY CHECK(id ~ '^po-[A-Za-z0-9_-]{1,100}$'),
  document_number TEXT NOT NULL CHECK(length(btrim(document_number)) BETWEEN 1 AND 100),
  document_date DATE NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('draft','pending_approval','approved','partial_received','received','rejected','cancelled','closed')),
  supplier_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  warehouse_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  source_pr_id TEXT REFERENCES inventory_sandbox.purchasing_prs(id) ON DELETE RESTRICT,
  header_payload JSONB NOT NULL CHECK(jsonb_typeof(header_payload)='object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX purchasing_po_number ON inventory_sandbox.purchasing_pos(lower(document_number));
CREATE INDEX purchasing_po_source_pr ON inventory_sandbox.purchasing_pos(source_pr_id) WHERE source_pr_id IS NOT NULL;

CREATE TABLE inventory_sandbox.purchasing_po_items (
  id TEXT PRIMARY KEY CHECK(id ~ '^[A-Za-z0-9_-]{1,100}$'),
  po_id TEXT NOT NULL REFERENCES inventory_sandbox.purchasing_pos(id) ON DELETE RESTRICT,
  line_no INTEGER NOT NULL CHECK(line_no BETWEEN 1 AND 100),
  raw_material_id TEXT,
  material_code_snapshot TEXT NOT NULL,
  material_name_snapshot TEXT NOT NULL,
  specification TEXT NOT NULL DEFAULT '',
  ordered_quantity NUMERIC(18,4) NOT NULL CHECK(ordered_quantity>0),
  received_quantity NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK(received_quantity>=0 AND received_quantity<=ordered_quantity),
  unit_id TEXT REFERENCES inventory_sandbox.settings_masters(id) ON DELETE RESTRICT,
  unit_snapshot TEXT NOT NULL,
  unit_price NUMERIC(18,2) NOT NULL CHECK(unit_price>=0),
  discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(discount_amount>=0),
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK(tax_amount>=0),
  expected_delivery_date DATE,
  remarks TEXT NOT NULL DEFAULT '',
  archived_at TIMESTAMPTZ,
  UNIQUE(po_id,id)
);
CREATE UNIQUE INDEX purchasing_active_po_line
  ON inventory_sandbox.purchasing_po_items(po_id,line_no) WHERE archived_at IS NULL;

CREATE TABLE inventory_sandbox.purchasing_po_history (
  id UUID PRIMARY KEY,
  po_id TEXT NOT NULL REFERENCES inventory_sandbox.purchasing_pos(id) ON DELETE RESTRICT,
  record_version BIGINT NOT NULL CHECK(record_version>0),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL CHECK(length(btrim(actor_id)) BETWEEN 1 AND 200),
  actor_display_name TEXT NOT NULL CHECK(length(btrim(actor_display_name)) BETWEEN 1 AND 200),
  occurred_at TIMESTAMPTZ NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  from_status TEXT,
  to_status TEXT NOT NULL,
  request_id UUID UNIQUE,
  UNIQUE(po_id,record_version,id)
);

CREATE TABLE inventory_sandbox.purchasing_pr_po_allocations (
  id UUID PRIMARY KEY,
  pr_id TEXT NOT NULL,
  pr_item_id TEXT NOT NULL,
  po_id TEXT NOT NULL,
  po_item_id TEXT NOT NULL,
  allocated_quantity NUMERIC(18,4) NOT NULL CHECK(allocated_quantity>0),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  allocated_by_event_id UUID NOT NULL REFERENCES inventory_sandbox.purchasing_po_history(id) ON DELETE RESTRICT,
  released_at TIMESTAMPTZ,
  released_by_event_id UUID REFERENCES inventory_sandbox.purchasing_po_history(id) ON DELETE RESTRICT,
  release_reason TEXT,
  FOREIGN KEY(pr_id,pr_item_id) REFERENCES inventory_sandbox.purchasing_pr_items(pr_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(po_id,po_item_id) REFERENCES inventory_sandbox.purchasing_po_items(po_id,id) ON DELETE RESTRICT,
  CHECK((released_at IS NULL AND released_by_event_id IS NULL AND release_reason IS NULL)
     OR (released_at IS NOT NULL AND released_by_event_id IS NOT NULL AND length(btrim(release_reason))>0))
);
CREATE UNIQUE INDEX purchasing_active_po_item_allocation
  ON inventory_sandbox.purchasing_pr_po_allocations(po_item_id) WHERE released_at IS NULL;
CREATE INDEX purchasing_active_pr_allocations
  ON inventory_sandbox.purchasing_pr_po_allocations(pr_item_id) WHERE released_at IS NULL;

CREATE INDEX purchasing_pr_recent ON inventory_sandbox.purchasing_prs(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX purchasing_po_recent ON inventory_sandbox.purchasing_pos(updated_at DESC) WHERE archived_at IS NULL;
CREATE INDEX purchasing_po_active_items ON inventory_sandbox.purchasing_po_items(po_id,line_no) WHERE archived_at IS NULL;
CREATE INDEX purchasing_pr_history_document ON inventory_sandbox.purchasing_pr_history(pr_id,record_version);
CREATE INDEX purchasing_po_history_document ON inventory_sandbox.purchasing_po_history(po_id,record_version);
COMMIT;
