BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
DO $$ BEGIN
  IF current_database() <> 'production' OR current_user <> 'foliar_fertilizer_owner'
    OR NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'foliar_fertilizer' AND pg_get_userbyid(nspowner) = current_user)
    OR to_regclass('foliar_fertilizer.m_qc_raw_material') IS NULL THEN
    RAISE EXCEPTION 'Unexpected QC migration target or missing legacy table';
  END IF;
END $$;
-- Lock legacy writes only while creating the shared document-number reservation.
LOCK TABLE foliar_fertilizer.m_qc_raw_material IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE foliar_fertilizer.m_qc_receiving_sheet (
  id uuid PRIMARY KEY,
  document_number text NOT NULL CHECK (length(btrim(document_number)) BETWEEN 1 AND 100),
  document_date date NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by text NOT NULL CHECK (length(created_by) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at timestamptz
);
CREATE UNIQUE INDEX qc_receiving_sheet_number ON foliar_fertilizer.m_qc_receiving_sheet(lower(btrim(document_number)));
CREATE INDEX qc_receiving_sheet_date ON foliar_fertilizer.m_qc_receiving_sheet(document_date DESC, id) WHERE archived_at IS NULL;
CREATE TABLE foliar_fertilizer.r_qc_receiving_sheet_lines (
  sheet_id uuid NOT NULL REFERENCES foliar_fertilizer.m_qc_receiving_sheet(id) ON DELETE RESTRICT,
  line_no integer NOT NULL CHECK (line_no BETWEEN 1 AND 10),
  material_code text NOT NULL CHECK (length(btrim(material_code)) BETWEEN 1 AND 100),
  supplier_code text NOT NULL CHECK (length(btrim(supplier_code)) BETWEEN 1 AND 100),
  quantity numeric(18,6) NOT NULL CHECK (quantity > 0 AND quantity < 'Infinity'::numeric),
  unit text NOT NULL CHECK (length(btrim(unit)) BETWEEN 1 AND 50),
  weight text NOT NULL CHECK (weight IN ('pass','acceptable','fail')),
  contamination text NOT NULL CHECK (contamination IN ('pass','acceptable','fail')),
  physical text NOT NULL CHECK (physical IN ('pass','acceptable','fail')),
  color text NOT NULL CHECK (color IN ('pass','acceptable','fail')),
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  PRIMARY KEY (sheet_id,line_no)
);
CREATE TABLE foliar_fertilizer.r_qc_receiving_sheet_history (
  id uuid PRIMARY KEY,
  sheet_id uuid NOT NULL REFERENCES foliar_fertilizer.m_qc_receiving_sheet(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL CHECK (record_version > 0),
  action text NOT NULL CHECK (action IN ('created','updated','archived')),
  actor_id text NOT NULL CHECK (length(actor_id) BETWEEN 1 AND 200),
  actor_display_name text NOT NULL CHECK (length(actor_display_name) BETWEEN 1 AND 200),
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changes jsonb NOT NULL CHECK (jsonb_typeof(changes) = 'object'),
  UNIQUE (sheet_id,record_version)
);
-- Owner-only namespace: existing archived numbers are reserved too, as in migration 0008.
CREATE TABLE foliar_fertilizer.qc_receiving_document_numbers (
  normalized_number text PRIMARY KEY,
  document_id uuid NOT NULL,
  document_kind text NOT NULL CHECK (document_kind IN ('legacy','paper')),
  UNIQUE (document_kind,document_id)
);
INSERT INTO foliar_fertilizer.qc_receiving_document_numbers(normalized_number,document_id,document_kind)
SELECT lower(btrim(document_number)), id, 'legacy' FROM foliar_fertilizer.m_qc_raw_material;
CREATE FUNCTION foliar_fertilizer.qc_receiving_reserve_number() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE kind text;
BEGIN
  IF TG_TABLE_SCHEMA <> 'foliar_fertilizer' THEN RAISE EXCEPTION 'Invalid document source'; END IF;
  CASE TG_TABLE_NAME
    WHEN 'm_qc_raw_material' THEN kind := 'legacy';
    WHEN 'm_qc_receiving_sheet' THEN kind := 'paper';
    ELSE RAISE EXCEPTION 'Invalid document source';
  END CASE;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM foliar_fertilizer.qc_receiving_document_numbers WHERE document_kind = kind AND document_id = OLD.id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.id <> NEW.id THEN RAISE EXCEPTION 'Document identity is immutable'; END IF;
    IF lower(btrim(OLD.document_number)) = lower(btrim(NEW.document_number)) THEN RETURN NEW; END IF;
    DELETE FROM foliar_fertilizer.qc_receiving_document_numbers WHERE document_kind = kind AND document_id = OLD.id;
  END IF;
  INSERT INTO foliar_fertilizer.qc_receiving_document_numbers(normalized_number,document_id,document_kind)
  VALUES (lower(btrim(NEW.document_number)),NEW.id,kind);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION foliar_fertilizer.qc_receiving_reserve_number() FROM PUBLIC, foliar_fertilizer_app;
CREATE TRIGGER qc_receiving_reserve_legacy_number BEFORE INSERT OR UPDATE OF document_number,id OR DELETE ON foliar_fertilizer.m_qc_raw_material FOR EACH ROW EXECUTE FUNCTION foliar_fertilizer.qc_receiving_reserve_number();
CREATE TRIGGER qc_receiving_reserve_paper_number BEFORE INSERT OR UPDATE OF document_number,id OR DELETE ON foliar_fertilizer.m_qc_receiving_sheet FOR EACH ROW EXECUTE FUNCTION foliar_fertilizer.qc_receiving_reserve_number();
REVOKE ALL ON TABLE foliar_fertilizer.m_qc_receiving_sheet, foliar_fertilizer.r_qc_receiving_sheet_lines, foliar_fertilizer.r_qc_receiving_sheet_history, foliar_fertilizer.qc_receiving_document_numbers FROM PUBLIC, foliar_fertilizer_app;
GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.m_qc_receiving_sheet TO foliar_fertilizer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON foliar_fertilizer.r_qc_receiving_sheet_lines TO foliar_fertilizer_app;
GRANT SELECT, INSERT ON foliar_fertilizer.r_qc_receiving_sheet_history TO foliar_fertilizer_app;
DO $$ DECLARE t text; p text; expected boolean; BEGIN
  FOREACH t IN ARRAY ARRAY['m_qc_receiving_sheet','r_qc_receiving_sheet_lines','r_qc_receiving_sheet_history','qc_receiving_document_numbers'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      expected := (t <> 'qc_receiving_document_numbers' AND p IN ('SELECT','INSERT')) OR (p='UPDATE' AND t IN ('m_qc_receiving_sheet','r_qc_receiving_sheet_lines')) OR (p='DELETE' AND t='r_qc_receiving_sheet_lines');
      IF has_table_privilege('foliar_fertilizer_app',format('%I.%I','foliar_fertilizer',t),p) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Unexpected grant on %: %',t,p; END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
