BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(20261125, 1);
LOCK TABLE foliar_fertilizer.production_order_doc_no_reservations IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM foliar_fertilizer.production_order_doc_no_reservations) THEN
  RAISE EXCEPTION 'Refusing rollback: PRD reservations exist';
 END IF;
END $$;
DROP TABLE foliar_fertilizer.production_order_doc_no_reservations;
DROP TABLE foliar_fertilizer.production_order_doc_no_counters;
COMMIT;
