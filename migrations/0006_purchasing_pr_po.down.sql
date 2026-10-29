-- REVIEWED ROLLBACK ONLY. Refuses to erase purchasing history or documents.
BEGIN;
DO $$ BEGIN
  IF current_database()<>'ionflow_inventory_dev' OR inet_server_port()<>5432
    OR inet_server_addr() IS NULL OR inet_server_addr() NOT IN ('127.0.0.1'::inet,'::1'::inet)
    OR current_user IN ('factory_readonly','factory_settings_writer','factory_production_writer','factory_auth_runtime','factory_purchasing_writer') THEN
    RAISE EXCEPTION 'Purchasing rollback target rejected';
  END IF;
  IF EXISTS(SELECT 1 FROM inventory_sandbox.purchasing_prs)
     OR EXISTS(SELECT 1 FROM inventory_sandbox.purchasing_pos)
     OR EXISTS(SELECT 1 FROM inventory_sandbox.purchasing_pr_history)
     OR EXISTS(SELECT 1 FROM inventory_sandbox.purchasing_po_history) THEN
    RAISE EXCEPTION 'Purchasing rollback refused: retained business or audit data exists';
  END IF;
END $$;
DROP TABLE inventory_sandbox.purchasing_pr_po_allocations;
DROP TABLE inventory_sandbox.purchasing_po_history;
DROP TABLE inventory_sandbox.purchasing_po_items;
DROP TABLE inventory_sandbox.purchasing_pos;
DROP TABLE inventory_sandbox.purchasing_pr_history;
DROP TABLE inventory_sandbox.purchasing_pr_items;
DROP TABLE inventory_sandbox.purchasing_prs;
COMMIT;
