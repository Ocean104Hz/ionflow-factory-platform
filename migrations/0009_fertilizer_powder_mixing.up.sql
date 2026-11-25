BEGIN;
SET LOCAL search_path TO pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF current_database() <> 'production' OR current_user <> 'foliar_fertilizer_owner' THEN
    RAISE EXCEPTION 'Unexpected database or migration role';
  END IF;
  IF to_regclass('foliar_fertilizer.m_qc_raw_material') IS NULL OR
     to_regclass('foliar_fertilizer.r_qc_raw_material_checks') IS NULL OR
     to_regclass('foliar_fertilizer.r_qc_raw_material_history') IS NULL THEN
    RAISE EXCEPTION 'Migration 0008 tables missing';
  END IF;
END $$;

CREATE TABLE foliar_fertilizer.m_fertilizer_powder_mixing (
  id uuid PRIMARY KEY,
  document_number text NOT NULL CHECK (length(btrim(document_number)) > 0),
  report_date date NOT NULL,
  fertilizer_snapshot text NOT NULL CHECK (length(btrim(fertilizer_snapshot)) > 0),
  lot_no text NOT NULL CHECK (length(btrim(lot_no)) > 0),
  shift text NOT NULL CHECK (length(btrim(shift)) > 0),
  location_snapshot text NOT NULL CHECK (length(btrim(location_snapshot)) > 0),
  loader_no text NOT NULL CHECK (length(btrim(loader_no)) > 0),
  mix_duration numeric CHECK (mix_duration > 0 AND mix_duration < 'Infinity'::numeric),
  inspector text NOT NULL DEFAULT '',
  inspector_date date,
  production text NOT NULL DEFAULT '',
  factory_qa text NOT NULL DEFAULT '',
  master_refs jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(master_refs) = 'object'),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by text NOT NULL CHECK (length(btrim(updated_by)) > 0),
  archived_at timestamptz
);
CREATE UNIQUE INDEX fertilizer_powder_mixing_document_number
  ON foliar_fertilizer.m_fertilizer_powder_mixing (lower(btrim(document_number)));
CREATE INDEX fertilizer_powder_mixing_report_date
  ON foliar_fertilizer.m_fertilizer_powder_mixing (report_date DESC, id) WHERE archived_at IS NULL;
CREATE INDEX fertilizer_powder_mixing_lot_no
  ON foliar_fertilizer.m_fertilizer_powder_mixing (lot_no) WHERE archived_at IS NULL;

CREATE TABLE foliar_fertilizer.r_fertilizer_powder_mixing_materials (
  report_id uuid NOT NULL REFERENCES foliar_fertilizer.m_fertilizer_powder_mixing(id) ON DELETE RESTRICT,
  id text NOT NULL CHECK (length(btrim(id)) > 0),
  line_no integer NOT NULL CHECK (line_no > 0),
  material_code_snapshot text NOT NULL CHECK (length(btrim(material_code_snapshot)) > 0),
  material_name_snapshot text NOT NULL CHECK (length(btrim(material_name_snapshot)) > 0),
  lot_no text NOT NULL DEFAULT '',
  order_qty numeric NOT NULL CHECK (order_qty > 0 AND order_qty < 'Infinity'::numeric),
  unit_snapshot text NOT NULL CHECK (length(btrim(unit_snapshot)) > 0),
  stock_balance numeric CHECK (stock_balance > '-Infinity'::numeric AND stock_balance < 'Infinity'::numeric),
  PRIMARY KEY (report_id, id),
  UNIQUE (report_id, line_no)
);
COMMENT ON COLUMN foliar_fertilizer.r_fertilizer_powder_mixing_materials.stock_balance IS 'Reference snapshot only; NULL means no verified stock source. Not an inventory transaction.';

CREATE TABLE foliar_fertilizer.r_fertilizer_powder_mixing_rounds (
  report_id uuid NOT NULL REFERENCES foliar_fertilizer.m_fertilizer_powder_mixing(id) ON DELETE RESTRICT,
  id text NOT NULL CHECK (length(btrim(id)) > 0),
  line_no integer NOT NULL CHECK (line_no > 0),
  round_date date NOT NULL,
  shift text NOT NULL CHECK (length(btrim(shift)) > 0),
  loader_load_count text NOT NULL CHECK (length(btrim(loader_load_count)) > 0),
  is_pass boolean,
  operator_mixer text NOT NULL CHECK (length(btrim(operator_mixer)) > 0),
  supervisor text NOT NULL CHECK (length(btrim(supervisor)) > 0),
  PRIMARY KEY (report_id, id),
  UNIQUE (report_id, line_no)
);
COMMENT ON COLUMN foliar_fertilizer.r_fertilizer_powder_mixing_rounds.is_pass IS 'NULL = pending inspection; true = pass; false = fail.';

CREATE TABLE foliar_fertilizer.r_fertilizer_powder_mixing_history (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES foliar_fertilizer.m_fertilizer_powder_mixing(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL CHECK (record_version > 0),
  action text NOT NULL CHECK (action IN ('created', 'updated', 'archived')),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  actor_display_name text NOT NULL CHECK (length(btrim(actor_display_name)) > 0),
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note text NOT NULL DEFAULT '',
  changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(changes) = 'array'),
  request_id uuid UNIQUE,
  UNIQUE (report_id, record_version)
);

REVOKE ALL ON TABLE
  foliar_fertilizer.m_fertilizer_powder_mixing,
  foliar_fertilizer.r_fertilizer_powder_mixing_materials,
  foliar_fertilizer.r_fertilizer_powder_mixing_rounds,
  foliar_fertilizer.r_fertilizer_powder_mixing_history
FROM PUBLIC, foliar_fertilizer_app;
GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.m_fertilizer_powder_mixing TO foliar_fertilizer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  foliar_fertilizer.r_fertilizer_powder_mixing_materials,
  foliar_fertilizer.r_fertilizer_powder_mixing_rounds TO foliar_fertilizer_app;
GRANT SELECT, INSERT ON foliar_fertilizer.r_fertilizer_powder_mixing_history TO foliar_fertilizer_app;

-- Check effective privileges, including inherited permissions, before commit.
DO $$
DECLARE
  t text;
  p text;
  expected boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['m_fertilizer_powder_mixing','r_fertilizer_powder_mixing_materials','r_fertilizer_powder_mixing_rounds','r_fertilizer_powder_mixing_history'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      expected := p IN ('SELECT','INSERT') OR
        (p = 'UPDATE' AND t <> 'r_fertilizer_powder_mixing_history') OR
        (p = 'DELETE' AND t IN ('r_fertilizer_powder_mixing_materials','r_fertilizer_powder_mixing_rounds'));
      IF has_table_privilege('foliar_fertilizer_app', format('%I.%I','foliar_fertilizer',t), p) IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'Unexpected privilege on %: %', t, p;
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
