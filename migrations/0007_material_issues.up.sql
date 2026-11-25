-- Material Issues: FR-P2-01/Rev.01.
-- Target database: production
-- Target schema: foliar_fertilizer
-- Migration owner: foliar_fertilizer_owner

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
            'Material issues migration target rejected';
    END IF;
END $$;


-- ==========================================
-- 1. หัวเอกสารใบเบิกจ่ายวัสดุ
-- ==========================================

CREATE TABLE foliar_fertilizer.material_issues (
    id TEXT PRIMARY KEY
        CHECK (id ~ '^mi-[A-Za-z0-9_-]{1,100}$'),

    document_number TEXT NOT NULL
        CHECK (
            length(btrim(document_number))
            BETWEEN 1 AND 100
        ),

    document_date DATE NOT NULL
        DEFAULT (
            CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Bangkok'
        )::DATE,

    location_snapshot TEXT NOT NULL
        CHECK (length(btrim(location_snapshot)) > 0),

    product_name_snapshot TEXT NOT NULL
        CHECK (length(btrim(product_name_snapshot)) > 0),

    product_quantity NUMERIC(18,4)
        CHECK (
            product_quantity >= 0
            AND product_quantity <> 'NaN'::NUMERIC
        ),

    department_snapshot TEXT NOT NULL DEFAULT '',

    requested_by TEXT NOT NULL DEFAULT '',
    issued_by TEXT NOT NULL DEFAULT '',
    inspected_by TEXT NOT NULL DEFAULT '',

    version BIGINT NOT NULL DEFAULT 1
        CHECK (version > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX material_issues_number
    ON foliar_fertilizer.material_issues (
        lower(document_number)
    );

CREATE INDEX material_issues_document_date
    ON foliar_fertilizer.material_issues (
        document_date DESC,
        id
    )
    WHERE archived_at IS NULL;

CREATE INDEX material_issues_recent
    ON foliar_fertilizer.material_issues (
        updated_at DESC
    )
    WHERE archived_at IS NULL;


-- ==========================================
-- 2. รายการวัสดุ
-- ==========================================

CREATE TABLE foliar_fertilizer.material_issue_items (
    id TEXT PRIMARY KEY
        CHECK (id ~ '^[A-Za-z0-9_-]{1,100}$'),

    material_issue_id TEXT NOT NULL
        REFERENCES foliar_fertilizer.material_issues(id)
        ON DELETE RESTRICT,

    line_no INTEGER NOT NULL
        CHECK (line_no > 0),

    material_code_snapshot TEXT NOT NULL
        CHECK (length(btrim(material_code_snapshot)) > 0),

    material_name_snapshot TEXT NOT NULL
        CHECK (length(btrim(material_name_snapshot)) > 0),

    quantity NUMERIC(18,4) NOT NULL
        CHECK (
            quantity > 0
            AND quantity <> 'NaN'::NUMERIC
        ),

    unit_snapshot TEXT NOT NULL
        CHECK (length(btrim(unit_snapshot)) > 0),

    damaged_quantity NUMERIC(18,4)
        CHECK (
            damaged_quantity >= 0
            AND damaged_quantity <> 'NaN'::NUMERIC
        ),

    additional_quantity NUMERIC(18,4)
        CHECK (
            additional_quantity >= 0
            AND additional_quantity <> 'NaN'::NUMERIC
        ),

    UNIQUE (material_issue_id, line_no)
);

CREATE INDEX material_issue_items_material_code
    ON foliar_fertilizer.material_issue_items (
        material_code_snapshot
    );


-- ==========================================
-- 3. ประวัติการเปลี่ยนแปลง
-- ==========================================

CREATE TABLE foliar_fertilizer.material_issue_history (
    id UUID PRIMARY KEY,

    material_issue_id TEXT NOT NULL
        REFERENCES foliar_fertilizer.material_issues(id)
        ON DELETE RESTRICT,

    record_version BIGINT NOT NULL
        CHECK (record_version > 0),

    action TEXT NOT NULL
        CHECK (
            action IN (
                'created',
                'updated',
                'archived'
            )
        ),

    actor_id TEXT NOT NULL
        CHECK (
            length(btrim(actor_id))
            BETWEEN 1 AND 200
        ),

    actor_display_name TEXT NOT NULL
        CHECK (
            length(btrim(actor_display_name))
            BETWEEN 1 AND 200
        ),

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    note TEXT NOT NULL DEFAULT '',

    changes JSONB NOT NULL DEFAULT '[]'::JSONB
        CHECK (jsonb_typeof(changes) = 'array'),

    request_id UUID UNIQUE,

    UNIQUE (material_issue_id, record_version)
);


-- ==========================================
-- Table Comments
-- ==========================================

COMMENT ON TABLE foliar_fertilizer.material_issues IS
    'Material issue document headers (FR-P2-01/Rev.01)';

COMMENT ON TABLE foliar_fertilizer.material_issue_items IS
    'Material issue document line items with material snapshots';

COMMENT ON TABLE foliar_fertilizer.material_issue_history IS
    'Material issue document audit history';

COMMENT ON COLUMN
    foliar_fertilizer.material_issues.archived_at IS
    'Soft delete timestamp; NULL means document is active';

COMMENT ON COLUMN
    foliar_fertilizer.material_issues.version IS
    'Record version for optimistic concurrency control';

COMMIT;