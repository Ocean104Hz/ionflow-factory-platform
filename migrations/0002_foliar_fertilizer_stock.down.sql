BEGIN;

SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

SET LOCAL lock_timeout = '5s';

SET LOCAL row_security = off;

-- Verify the rollback target.
DO $$
BEGIN
  IF current_database() <> 'production' THEN
    RAISE EXCEPTION 'Rollback must run on database production';
  END IF;

  IF current_user <> 'foliar_fertilizer_owner' THEN
    RAISE EXCEPTION 'Rollback must run as foliar_fertilizer_owner';
  END IF;

  IF to_regnamespace('foliar_fertilizer') IS NULL THEN
    RAISE EXCEPTION 'Schema foliar_fertilizer does not exist';
  END IF;
END $$;

-- Prevent concurrent writes between the empty-table check and DROP.
LOCK TABLE
  foliar_fertilizer.r_stock_document_lines,
  foliar_fertilizer.m_stock_documents,
  foliar_fertilizer.m_stock_locations,
  foliar_fertilizer.m_stock_items,
  foliar_fertilizer.m_stock_customers
IN ACCESS EXCLUSIVE MODE;

-- Refuse to roll back if any stock or master data exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM foliar_fertilizer.r_stock_document_lines
  )
    OR EXISTS (
      SELECT 1 FROM foliar_fertilizer.m_stock_documents
    )
    OR EXISTS (
      SELECT 1 FROM foliar_fertilizer.m_stock_locations
    )
    OR EXISTS (
      SELECT 1 FROM foliar_fertilizer.m_stock_items
    )
    OR EXISTS (
      SELECT 1 FROM foliar_fertilizer.m_stock_customers
    )
  THEN
    RAISE EXCEPTION 'Rollback refused: stock tables contain data';
  END IF;
END $$;

-- Drop only the new tables, in reverse dependency order.
DROP TABLE foliar_fertilizer.r_stock_document_lines RESTRICT;

DROP TABLE foliar_fertilizer.m_stock_documents RESTRICT;

DROP TABLE foliar_fertilizer.m_stock_locations RESTRICT;

DROP TABLE foliar_fertilizer.m_stock_items RESTRICT;

DROP TABLE foliar_fertilizer.m_stock_customers RESTRICT;

COMMIT;