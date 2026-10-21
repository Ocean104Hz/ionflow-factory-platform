-- PREPARED / NOT APPLIED. Manual rollback only after explicit approval.
-- Never remove migration history containing records; no CASCADE.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_sandbox.schema_migrations) THEN
    RAISE EXCEPTION 'Rollback refused: preserve existing migration history';
  END IF;
  DROP TABLE inventory_sandbox.schema_migrations;
END;
$$;
COMMIT;
