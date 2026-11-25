BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = pg_catalog;

-- ตรวจสอบฐานข้อมูลและสิทธิ์ก่อนสร้างตาราง
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
        RAISE EXCEPTION 'QC raw material migration target rejected';
    END IF;
END $$;


-- ==========================================
-- 1. ข้อมูลหลักใบตรวจสอบวัตถุดิบ
-- ==========================================

CREATE TABLE foliar_fertilizer.m_qc_raw_material (
    id UUID PRIMARY KEY,

    document_number TEXT NOT NULL
        CHECK (length(btrim(document_number)) BETWEEN 1 AND 100),

    document_date DATE NOT NULL,

    location_snapshot TEXT NOT NULL
        CHECK (length(btrim(location_snapshot)) > 0),

    lot_number TEXT NOT NULL
        CHECK (length(btrim(lot_number)) > 0),

    trip_number INTEGER
        CHECK (trip_number > 0),

    sender_snapshot TEXT NOT NULL
        CHECK (length(btrim(sender_snapshot)) > 0),

    material_snapshot TEXT NOT NULL
        CHECK (length(btrim(material_snapshot)) > 0),

    reference_document TEXT NOT NULL DEFAULT '',

    inspector TEXT NOT NULL DEFAULT '',
    inspector_date DATE,

    approver TEXT NOT NULL DEFAULT '',
    approver_date DATE,

    finalized BOOLEAN NOT NULL DEFAULT FALSE,

    master_refs JSONB NOT NULL DEFAULT '{}'::JSONB
        CHECK (jsonb_typeof(master_refs) = 'object'),

    version BIGINT NOT NULL DEFAULT 1
        CHECK (version > 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,

    CHECK (
        (btrim(approver) = '' AND approver_date IS NULL)
        OR
        (btrim(approver) <> '' AND approver_date IS NOT NULL)
    ),

    CHECK (
        NOT finalized
        OR (
            btrim(inspector) <> ''
            AND inspector_date IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX qc_raw_material_document_number
    ON foliar_fertilizer.m_qc_raw_material (
        lower(btrim(document_number))
    );

CREATE INDEX qc_raw_material_document_date
    ON foliar_fertilizer.m_qc_raw_material (
        document_date DESC,
        id
    )
    WHERE archived_at IS NULL;

CREATE INDEX qc_raw_material_lot_number
    ON foliar_fertilizer.m_qc_raw_material (
        lot_number
    )
    WHERE archived_at IS NULL;


-- ==========================================
-- 2. รายการตรวจสอบคุณภาพ 7 หัวข้อ
-- ==========================================

CREATE TABLE foliar_fertilizer.r_qc_raw_material_checks (
    inspection_id UUID NOT NULL
        REFERENCES foliar_fertilizer.m_qc_raw_material(id)
        ON DELETE RESTRICT,

    check_key TEXT NOT NULL
        CHECK (
            check_key IN (
                'color',
                'moisture',
                'impurities',
                'sieve',
                'solubility',
                'bag',
                'physical'
            )
        ),

    result TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            result IN (
                'pending',
                'pass',
                'fail',
                'na'
            )
        ),

    note TEXT NOT NULL DEFAULT '',

    PRIMARY KEY (inspection_id, check_key)
);


-- ==========================================
-- 3. ประวัติการเปลี่ยนแปลง
-- ==========================================

CREATE TABLE foliar_fertilizer.r_qc_raw_material_history (
    id UUID PRIMARY KEY,

    inspection_id UUID NOT NULL
        REFERENCES foliar_fertilizer.m_qc_raw_material(id)
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
        CHECK (length(btrim(actor_id)) BETWEEN 1 AND 200),

    actor_display_name TEXT NOT NULL
        CHECK (length(btrim(actor_display_name)) BETWEEN 1 AND 200),

    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    note TEXT NOT NULL DEFAULT '',

    changes JSONB NOT NULL DEFAULT '[]'::JSONB
        CHECK (jsonb_typeof(changes) = 'array'),

    request_id UUID UNIQUE,

    UNIQUE (inspection_id, record_version)
);


-- ==========================================
-- 4. กำหนดสิทธิ์ Runtime
-- ==========================================

GRANT SELECT, INSERT, UPDATE
ON foliar_fertilizer.m_qc_raw_material
TO foliar_fertilizer_app;

GRANT SELECT, INSERT, UPDATE, DELETE
ON foliar_fertilizer.r_qc_raw_material_checks
TO foliar_fertilizer_app;

GRANT SELECT, INSERT
ON foliar_fertilizer.r_qc_raw_material_history
TO foliar_fertilizer_app;


-- ==========================================
-- 5. คำอธิบายตาราง
-- ==========================================

COMMENT ON TABLE foliar_fertilizer.m_qc_raw_material
IS 'Raw material quality inspection document headers';

COMMENT ON TABLE foliar_fertilizer.r_qc_raw_material_checks
IS 'Seven raw material quality inspection checks';

COMMENT ON TABLE foliar_fertilizer.r_qc_raw_material_history
IS 'Raw material inspection audit history';

REVOKE DELETE
ON foliar_fertilizer.m_qc_raw_material
FROM foliar_fertilizer_app;

REVOKE UPDATE, DELETE
ON foliar_fertilizer.r_qc_raw_material_history
FROM foliar_fertilizer_app;

COMMIT;