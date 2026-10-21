-- Manual rollback only. Never removes historical/user records.
BEGIN;
DO $$ BEGIN
  IF current_database()<>'ionflow_inventory_dev' OR inet_server_port()<>5432
    OR inet_server_addr() IS NULL OR inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet)
    OR current_user IN ('factory_readonly','factory_settings_writer','factory_production_writer') THEN
    RAISE EXCEPTION 'Production Orders rollback target rejected';
  END IF;
  IF EXISTS(SELECT 1 FROM inventory_sandbox.production_orders)
    OR EXISTS(SELECT 1 FROM inventory_sandbox.production_order_history) THEN
    RAISE EXCEPTION 'Rollback refused: preserve existing Production Orders and history';
  END IF;
END $$;
DROP TABLE inventory_sandbox.production_order_history;
DROP TABLE inventory_sandbox.production_orders;
COMMIT;
