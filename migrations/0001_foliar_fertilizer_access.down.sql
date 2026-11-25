BEGIN;

DO $$
BEGIN
  IF current_database() <> 'production' OR current_user <> 'foliar_fertilizer_owner' THEN
    RAISE EXCEPTION 'Rollback must run on production as foliar_fertilizer_owner';
  END IF;
  IF EXISTS (SELECT 1 FROM foliar_fertilizer.app_users) THEN
    RAISE EXCEPTION 'Rollback refused: app_users contains data';
  END IF;
END $$;

DROP TABLE foliar_fertilizer.app_role_modules;
DROP TABLE foliar_fertilizer.app_user_roles;
DROP TABLE foliar_fertilizer.app_modules;
DROP TABLE foliar_fertilizer.app_roles;
DROP TABLE foliar_fertilizer.app_users;

COMMIT;
