BEGIN;
SET LOCAL search_path TO pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$
BEGIN
  IF current_database() <> 'production' OR current_user <> 'foliar_fertilizer_owner' THEN
    RAISE EXCEPTION 'Unexpected database or migration role';
  END IF;
END $$;
LOCK TABLE
  foliar_fertilizer.m_fertilizer_powder_mixing,
  foliar_fertilizer.r_fertilizer_powder_mixing_materials,
  foliar_fertilizer.r_fertilizer_powder_mixing_rounds,
  foliar_fertilizer.r_fertilizer_powder_mixing_history
IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM foliar_fertilizer.m_fertilizer_powder_mixing) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_fertilizer_powder_mixing_materials) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_fertilizer_powder_mixing_rounds) OR
     EXISTS (SELECT 1 FROM foliar_fertilizer.r_fertilizer_powder_mixing_history) THEN
    RAISE EXCEPTION 'Rollback refused: mixing report data exists';
  END IF;
END $$;
DROP TABLE foliar_fertilizer.r_fertilizer_powder_mixing_history;
DROP TABLE foliar_fertilizer.r_fertilizer_powder_mixing_rounds;
DROP TABLE foliar_fertilizer.r_fertilizer_powder_mixing_materials;
DROP TABLE foliar_fertilizer.m_fertilizer_powder_mixing;
COMMIT;
