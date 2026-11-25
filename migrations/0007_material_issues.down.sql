-- Material Issues Rollback.
-- Target database: production
-- Target schema: foliar_fertilizer
-- Migration owner: foliar_fertilizer_owner
-- Refuses rollback when business or audit data exists.

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
        RAISE EXCEPTION
            'Material issues rollback target rejected';
    END IF;
END $$;


-- ป้องกันการเขียนข้อมูลระหว่าง Rollback

LOCK TABLE
    foliar_fertilizer.material_issues,
    foliar_fertilizer.material_issue_items,
    foliar_fertilizer.material_issue_history
IN ACCESS EXCLUSIVE MODE;


-- ป้องกันการลบข้อมูลที่มีอยู่

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM foliar_fertilizer.material_issues
    )
    OR EXISTS (
        SELECT 1
        FROM foliar_fertilizer.material_issue_items
    )
    OR EXISTS (
        SELECT 1
        FROM foliar_fertilizer.material_issue_history
    )
    THEN
        RAISE EXCEPTION
            'Material issues rollback refused: retained business or audit data exists';
    END IF;
END $$;


-- ลบตารางตามลำดับ Foreign Key

DROP TABLE foliar_fertilizer.material_issue_history;
DROP TABLE foliar_fertilizer.material_issue_items;
DROP TABLE foliar_fertilizer.material_issues;

COMMIT;