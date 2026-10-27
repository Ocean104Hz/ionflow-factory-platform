-- PREPARED / NOT APPLIED. Manual rollback only while every Auth table is empty.
-- Never use CASCADE and never delete authentication history to make rollback pass.
BEGIN;

DO $$ BEGIN
  IF current_database() <> 'ionflow_inventory_dev'
     OR inet_server_port() <> 5432
     OR inet_server_addr() IS NULL
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR current_user IN (
       'factory_readonly',
       'factory_settings_writer',
       'factory_production_writer',
       'factory_bulk_writer',
       'factory_auth_runtime'
     ) THEN
    RAISE EXCEPTION 'Factory Auth rollback target rejected';
  END IF;
  IF EXISTS (SELECT 1 FROM inventory_sandbox.factory_auth_events)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_sessions)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_membership_sites)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_membership_roles)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_role_permissions)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_permissions)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_roles)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_memberships)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_identity_links)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_local_credentials)
     OR EXISTS (SELECT 1 FROM inventory_sandbox.factory_users) THEN
    RAISE EXCEPTION 'Rollback refused: preserve Factory Auth data and audit history';
  END IF;
END $$;

DROP TABLE inventory_sandbox.factory_membership_sites;
DROP TABLE inventory_sandbox.factory_membership_roles;
DROP TABLE inventory_sandbox.factory_role_permissions;
DROP TABLE inventory_sandbox.factory_auth_events;
DROP TABLE inventory_sandbox.factory_sessions;
DROP TABLE inventory_sandbox.factory_permissions;
DROP TABLE inventory_sandbox.factory_roles;
DROP TABLE inventory_sandbox.factory_memberships;
DROP TABLE inventory_sandbox.factory_identity_links;
DROP TABLE inventory_sandbox.factory_local_credentials;
DROP TABLE inventory_sandbox.factory_users;

COMMIT;
