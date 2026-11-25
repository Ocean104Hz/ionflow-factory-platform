BEGIN;
SET LOCAL search_path TO pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF current_database() <> 'production' OR current_user <> 'foliar_fertilizer_owner' THEN
    RAISE EXCEPTION 'Unexpected database or migration role';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace
    WHERE nspname = 'foliar_fertilizer' AND pg_get_userbyid(nspowner) = current_user) THEN
    RAISE EXCEPTION 'Unexpected schema owner';
  END IF;
END $$;

-- 0006 is a gap in the repository migration numbering. No dependency on 0007-0009.
-- Fail on any existing relation; never overwrite an existing table.
CREATE TABLE foliar_fertilizer.m_production_quality (
  id uuid PRIMARY KEY,
  document_number text NOT NULL DEFAULT '',
  profile_id text NOT NULL CHECK (profile_id IN ('ITECH', 'IFOAM')),
  inspection_date date CHECK (inspection_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
  production_site text NOT NULL DEFAULT '',
  production_line text NOT NULL DEFAULT '',
  record_status text NOT NULL DEFAULT 'DRAFT' CHECK (record_status IN ('DRAFT', 'RECORDED')),
  disposition text NOT NULL DEFAULT 'NOT_EVALUATED' CHECK (disposition = 'NOT_EVALUATED'),
  machine_start time CHECK (machine_start < TIME '24:00' AND extract(second FROM machine_start) = 0),
  work_start time CHECK (work_start < TIME '24:00' AND extract(second FROM work_start) = 0),
  work_stop time CHECK (work_stop < TIME '24:00' AND extract(second FROM work_stop) = 0),
  notes text NOT NULL DEFAULT '',
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
  updated_by text NOT NULL CHECK (length(btrim(updated_by)) > 0),
  archived_at timestamptz,
  CHECK (production_line = '' OR
    (profile_id = 'ITECH' AND production_line IN ('T1','T2','T4')) OR
    (profile_id = 'IFOAM' AND production_line IN ('F1','F2','F3'))),
  CHECK (record_status = 'DRAFT' OR
    (inspection_date IS NOT NULL AND length(btrim(document_number)) > 0 AND
     length(btrim(production_site)) > 0 AND length(btrim(production_line)) > 0)),
  CHECK (updated_at >= created_at),
  CHECK (archived_at IS NULL OR archived_at >= created_at)
);
-- Keep issued numbers reserved even after archiving; drafts may have no number.
CREATE UNIQUE INDEX production_quality_document_number
  ON foliar_fertilizer.m_production_quality (profile_id, lower(btrim(document_number)))
  WHERE length(btrim(document_number)) > 0;
CREATE INDEX production_quality_inspection_date
  ON foliar_fertilizer.m_production_quality (inspection_date DESC, id) WHERE archived_at IS NULL;
CREATE INDEX production_quality_profile_line_date
  ON foliar_fertilizer.m_production_quality (profile_id, production_line, inspection_date DESC, id)
  WHERE archived_at IS NULL;

CREATE TABLE foliar_fertilizer.r_production_quality_formulas (
  inspection_id uuid NOT NULL REFERENCES foliar_fertilizer.m_production_quality(id) ON DELETE RESTRICT,
  id text NOT NULL CHECK (length(btrim(id)) > 0),
  line_no integer NOT NULL CHECK (line_no > 0),
  formula_name text NOT NULL DEFAULT '',
  lot_code text NOT NULL DEFAULT '',
  start_time time CHECK (start_time IN (TIME '09:00', TIME '10:00', TIME '11:00', TIME '13:00', TIME '14:00', TIME '15:00', TIME '16:00', TIME '17:00', TIME '18:00', TIME '19:00', TIME '20:00', TIME '21:00', TIME '22:00', TIME '23:00', TIME '01:00', TIME '02:00', TIME '03:00', TIME '04:00', TIME '05:00', TIME '06:00', TIME '07:00')),
  end_time time CHECK (end_time IN (TIME '09:00', TIME '10:00', TIME '11:00', TIME '13:00', TIME '14:00', TIME '15:00', TIME '16:00', TIME '17:00', TIME '18:00', TIME '19:00', TIME '20:00', TIME '21:00', TIME '22:00', TIME '23:00', TIME '01:00', TIME '02:00', TIME '03:00', TIME '04:00', TIME '05:00', TIME '06:00', TIME '07:00')),
  extra_slots time[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (inspection_id, id),
  UNIQUE (inspection_id, line_no),
  CHECK ((length(btrim(formula_name)) > 0) = (length(btrim(lot_code)) > 0)),
  CHECK ((start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND
     ROW(start_time < TIME '09:00', start_time) <= ROW(end_time < TIME '09:00', end_time))),
  CHECK (cardinality(extra_slots) <= 21 AND
    (cardinality(extra_slots) = 0 OR (array_ndims(extra_slots) = 1 AND array_lower(extra_slots, 1) = 1)) AND
    array_position(extra_slots, NULL::time) IS NULL AND
    extra_slots <@ ARRAY[TIME '09:00', TIME '10:00', TIME '11:00', TIME '13:00', TIME '14:00', TIME '15:00', TIME '16:00', TIME '17:00', TIME '18:00', TIME '19:00', TIME '20:00', TIME '21:00', TIME '22:00', TIME '23:00', TIME '01:00', TIME '02:00', TIME '03:00', TIME '04:00', TIME '05:00', TIME '06:00', TIME '07:00'])
);
CREATE INDEX production_quality_formula_name ON foliar_fertilizer.r_production_quality_formulas (formula_name, inspection_id);
CREATE INDEX production_quality_formula_lot ON foliar_fertilizer.r_production_quality_formulas (lot_code, inspection_id);

CREATE TABLE foliar_fertilizer.r_production_quality_readings (
  inspection_id uuid NOT NULL REFERENCES foliar_fertilizer.m_production_quality(id) ON DELETE RESTRICT,
  metric_code text NOT NULL,
  sample_time time NOT NULL CHECK (sample_time IN (TIME '09:00', TIME '10:00', TIME '11:00', TIME '13:00', TIME '14:00', TIME '15:00', TIME '16:00', TIME '17:00', TIME '18:00', TIME '19:00', TIME '20:00', TIME '21:00', TIME '22:00', TIME '23:00', TIME '01:00', TIME '02:00', TIME '03:00', TIME '04:00', TIME '05:00', TIME '06:00', TIME '07:00')),
  value_type text NOT NULL,
  numeric_value numeric(13,3) CHECK (numeric_value BETWEEN 0 AND 1000000000),
  duration_seconds integer CHECK (duration_seconds BETWEEN 0 AND 59999),
  text_value text,
  boolean_value boolean,
  temperature_values numeric(13,3)[],
  raw_value text,
  note text NOT NULL DEFAULT '',
  PRIMARY KEY (inspection_id, metric_code, sample_time),
  CHECK (
    (value_type = 'numeric' AND metric_code IN ('moisture_content', 'bulk_density', 'percent_retained_5mm', 'percent_retained_2mm', 'percent_tray', 'inverter_status', 'granule_hardness')) OR
    (value_type = 'duration' AND metric_code = 'water_solubility') OR
    (value_type = 'text' AND metric_code = 'dust_environment') OR
    (value_type = 'boolean' AND metric_code IN ('bigbag_code_marking', 'amino_drop_at_disc', 'imo_spraying', 'granule_coating', 'operator_presence')) OR
    (value_type = 'temperature' AND metric_code IN ('dryer_temperature_group_a','dryer_temperature_group_b'))
  ),
  -- A missing reading is NULL, including an explicit uninspected Boolean.
  CHECK (numeric_value IS NULL OR value_type = 'numeric'),
  CHECK (duration_seconds IS NULL OR value_type = 'duration'),
  CHECK (text_value IS NULL OR (value_type = 'text' AND text_value IN ('น้อย','กลาง','มาก','ฝุ่นปานกลาง','ฝุ่นเยอะ','ฝุ่นเยอะมาก'))),
  CHECK (boolean_value IS NULL OR value_type = 'boolean'),
  CHECK (temperature_values IS NULL OR value_type = 'temperature'),
  CHECK (metric_code NOT IN ('moisture_content','percent_retained_5mm','percent_retained_2mm','percent_tray')
    OR numeric_value <= 100),
  CHECK (temperature_values IS NULL OR (
    cardinality(temperature_values) > 0 AND array_ndims(temperature_values) = 1 AND array_lower(temperature_values,1) = 1 AND
    cardinality(temperature_values) = CASE metric_code WHEN 'dryer_temperature_group_a' THEN 4 ELSE 6 END AND
    0 <= ALL(temperature_values) AND 1000000000 >= ALL(temperature_values)
  ))
);
COMMENT ON COLUMN foliar_fertilizer.r_production_quality_readings.raw_value IS 'Optional original input text, including the 5 mm sieve dash; API validates correspondence to typed values.';
COMMENT ON COLUMN foliar_fertilizer.r_production_quality_readings.temperature_values IS 'Ordered points; NULL elements mean unmeasured. A=4 and B=6.';

CREATE TABLE foliar_fertilizer.r_production_quality_machine_stops (
  inspection_id uuid NOT NULL REFERENCES foliar_fertilizer.m_production_quality(id) ON DELETE RESTRICT,
  id text NOT NULL CHECK (length(btrim(id)) > 0),
  line_no integer NOT NULL CHECK (line_no > 0),
  stop_time time CHECK (stop_time < TIME '24:00' AND extract(second FROM stop_time) = 0),
  restart_time time CHECK (restart_time < TIME '24:00' AND extract(second FROM restart_time) = 0),
  reason text NOT NULL DEFAULT '',
  PRIMARY KEY (inspection_id, id),
  UNIQUE (inspection_id, line_no),
  CHECK ((stop_time IS NULL AND restart_time IS NULL AND btrim(reason) = '') OR
    (stop_time IS NOT NULL AND restart_time IS NOT NULL AND stop_time <> restart_time AND length(btrim(reason)) > 0))
);
-- Cross-midnight ordering, overlap and work-time boundaries are service rules.
CREATE TABLE foliar_fertilizer.r_production_quality_signers (
  inspection_id uuid NOT NULL REFERENCES foliar_fertilizer.m_production_quality(id) ON DELETE RESTRICT,
  role_code text NOT NULL CHECK (role_code IN ('inspector','supervisor','production','factory_qa')),
  signer_name text NOT NULL DEFAULT '',
  signed_date date CHECK (signed_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
  PRIMARY KEY (inspection_id, role_code),
  CHECK (signed_date IS NULL OR length(btrim(signer_name)) > 0)
);
COMMENT ON TABLE foliar_fertilizer.r_production_quality_signers IS 'Recorded signer names, not authenticated approval or digital signatures.';
CREATE TABLE foliar_fertilizer.r_production_quality_history (
  id uuid PRIMARY KEY,
  inspection_id uuid NOT NULL REFERENCES foliar_fertilizer.m_production_quality(id) ON DELETE RESTRICT,
  record_version bigint NOT NULL CHECK (record_version > 0),
  action text NOT NULL CHECK (action IN ('created','updated','archived')),
  actor_id text NOT NULL CHECK (length(btrim(actor_id)) > 0),
  actor_display_name text NOT NULL CHECK (length(btrim(actor_display_name)) > 0),
  changes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(changes) = 'array'),
  occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (inspection_id, record_version)
);

REVOKE ALL ON TABLE
  foliar_fertilizer.m_production_quality,
  foliar_fertilizer.r_production_quality_formulas,
  foliar_fertilizer.r_production_quality_readings,
  foliar_fertilizer.r_production_quality_machine_stops,
  foliar_fertilizer.r_production_quality_signers,
  foliar_fertilizer.r_production_quality_history
FROM PUBLIC, foliar_fertilizer_app;
GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.m_production_quality TO foliar_fertilizer_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  foliar_fertilizer.r_production_quality_formulas,
  foliar_fertilizer.r_production_quality_readings,
  foliar_fertilizer.r_production_quality_machine_stops,
  foliar_fertilizer.r_production_quality_signers
TO foliar_fertilizer_app;
GRANT SELECT, INSERT ON foliar_fertilizer.r_production_quality_history TO foliar_fertilizer_app;

-- Verify effective permissions, including inherited grants, before COMMIT.
DO $$
DECLARE
  t text;
  p text;
  expected boolean;
BEGIN
  FOREACH t IN ARRAY ARRAY['m_production_quality', 'r_production_quality_formulas', 'r_production_quality_readings', 'r_production_quality_machine_stops', 'r_production_quality_signers', 'r_production_quality_history'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      expected := p IN ('SELECT','INSERT') OR
        (p = 'UPDATE' AND t <> 'r_production_quality_history') OR
        (p = 'DELETE' AND t IN ('r_production_quality_formulas', 'r_production_quality_readings', 'r_production_quality_machine_stops', 'r_production_quality_signers'));
      IF has_table_privilege('foliar_fertilizer_app', format('%I.%I','foliar_fertilizer',t), p) IS DISTINCT FROM expected THEN
        RAISE EXCEPTION 'Unexpected privilege on %: %', t, p;
      END IF;
    END LOOP;
  END LOOP;
END $$;
COMMIT;
