-- Rollback is intentionally blocked once paper documents exist. Never delete business data.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
 IF current_database() <> 'production' OR current_user <> 'foliar_fertilizer_owner' THEN RAISE EXCEPTION 'Unexpected target'; END IF;
END $$;
LOCK TABLE foliar_fertilizer.m_qc_raw_material, foliar_fertilizer.m_qc_receiving_sheet, foliar_fertilizer.r_qc_receiving_sheet_lines, foliar_fertilizer.r_qc_receiving_sheet_history IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM foliar_fertilizer.m_qc_receiving_sheet) OR EXISTS (SELECT 1 FROM foliar_fertilizer.r_qc_receiving_sheet_lines) OR EXISTS (SELECT 1 FROM foliar_fertilizer.r_qc_receiving_sheet_history) THEN RAISE EXCEPTION 'Paper documents exist: rollback rejected, use forward fix'; END IF;
END $$;
DROP TRIGGER qc_receiving_reserve_legacy_number ON foliar_fertilizer.m_qc_raw_material;
DROP TRIGGER qc_receiving_reserve_paper_number ON foliar_fertilizer.m_qc_receiving_sheet;
DROP FUNCTION foliar_fertilizer.qc_receiving_reserve_number();
DROP TABLE foliar_fertilizer.r_qc_receiving_sheet_history, foliar_fertilizer.r_qc_receiving_sheet_lines, foliar_fertilizer.m_qc_receiving_sheet, foliar_fertilizer.qc_receiving_document_numbers;
COMMIT;
