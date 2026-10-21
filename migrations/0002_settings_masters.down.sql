-- PREPARED / NOT APPLIED. Only an EMPTY Settings table may be rolled back.
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ionflow_inventory_dev' THEN RAISE EXCEPTION 'Wrong database'; END IF;
  IF EXISTS (SELECT 1 FROM inventory_sandbox.settings_masters) THEN
    RAISE EXCEPTION 'Rollback refused: preserve Settings data; use a reviewed forward recovery';
  END IF;
END $$;
DROP TABLE inventory_sandbox.settings_masters;
COMMIT;
