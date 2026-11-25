BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;

DO $$
BEGIN
    IF current_database() <> 'production'
        OR current_user <> 'foliar_fertilizer_owner'
        OR NOT EXISTS (
            SELECT 1
            FROM pg_namespace
            WHERE nspname = 'foliar_fertilizer'
              AND pg_get_userbyid(nspowner) = current_user
        )
    THEN
        RAISE EXCEPTION 'QC raw material rollback target rejected';
    END IF;
END $$;

LOCK TABLE
    foliar_fertilizer.m_qc_raw_material,
    foliar_fertilizer.r_qc_raw_material_checks,
    foliar_fertilizer.r_qc_raw_material_history
IN ACCESS EXCLUSIVE MODE;

-- Prevent accidental loss of inspection data.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM foliar_fertilizer.m_qc_raw_material
    ) OR EXISTS (
        SELECT 1 FROM foliar_fertilizer.r_qc_raw_material_checks
    ) OR EXISTS (
        SELECT 1 FROM foliar_fertilizer.r_qc_raw_material_history
    ) THEN
        RAISE EXCEPTION 'Rollback rejected: QC tables contain data';
    END IF;
END $$;

DROP TABLE foliar_fertilizer.r_qc_raw_material_history;
DROP TABLE foliar_fertilizer.r_qc_raw_material_checks;
DROP TABLE foliar_fertilizer.m_qc_raw_material;

COMMIT;