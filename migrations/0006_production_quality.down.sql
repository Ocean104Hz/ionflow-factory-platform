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

-- Rollback is allowed only when every table is empty. No CASCADE.
LOCK TABLE
  foliar_fertilizer.m_production_quality,
  foliar_fertilizer.r_production_quality_formulas,
  foliar_fertilizer.r_production_quality_readings,
  foliar_fertilizer.r_production_quality_machine_stops,
  foliar_fertilizer.r_production_quality_signers,
  foliar_fertilizer.r_production_quality_history
IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM foliar_fertilizer.m_production_quality) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_production_quality_formulas) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_production_quality_readings) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_production_quality_machine_stops) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_production_quality_signers) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_production_quality_history) THEN
    RAISE EXCEPTION 'Rollback refused: production quality data exists';
  END IF;
END $$;
DROP TABLE foliar_fertilizer.r_production_quality_history;
DROP TABLE foliar_fertilizer.r_production_quality_signers;
DROP TABLE foliar_fertilizer.r_production_quality_machine_stops;
DROP TABLE foliar_fertilizer.r_production_quality_readings;
DROP TABLE foliar_fertilizer.r_production_quality_formulas;
DROP TABLE foliar_fertilizer.m_production_quality;
COMMIT;
