BEGIN;

-- Verify the migration target and roles.
DO $$
BEGIN
  IF current_database() <> 'production' THEN
    RAISE EXCEPTION 'Migration must run on database production';
  END IF;

  IF current_user <> 'foliar_fertilizer_owner' THEN
    RAISE EXCEPTION 'Migration must run as foliar_fertilizer_owner';
  END IF;

  IF to_regnamespace('foliar_fertilizer') IS NULL THEN
    RAISE EXCEPTION 'Schema foliar_fertilizer does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_roles
    WHERE rolname = 'foliar_fertilizer_app'
  ) THEN
    RAISE EXCEPTION 'Runtime role foliar_fertilizer_app does not exist';
  END IF;
END $$;


-- ==================================================
-- 1. STOCK CUSTOMER MASTER
-- ==================================================

CREATE TABLE foliar_fertilizer.m_stock_customers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  customer_code text UNIQUE,
  name text NOT NULL,
  note text,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ==================================================
-- 2. STOCK ITEM MASTER
-- ==================================================

CREATE TABLE foliar_fertilizer.m_stock_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  item_code text,
  legacy_code text,

  item_type text NOT NULL CHECK (
    item_type IN (
      'RM',
      'WIP',
      'PACKAGING',
      'FG'
    )
  ),

  name text NOT NULL,
  item_group text,
  added_date date,
  specification text,
  stock_unit text NOT NULL,
  safety_stock_qty numeric,

  note text,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ==================================================
-- 3. STOCK LOCATION MASTER
-- ==================================================

CREATE TABLE foliar_fertilizer.m_stock_locations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  location_code text NOT NULL UNIQUE,
  name text NOT NULL,
  note text,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ==================================================
-- 4. STOCK DOCUMENT MASTER
-- ==================================================

CREATE TABLE foliar_fertilizer.m_stock_documents (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  document_type text NOT NULL CHECK (
    document_type IN (
      'SO',
      'OPENING',
      'RECEIPT',
      'ISSUE',
      'TRANSFER',
      'COUNT',
      'ADJUSTMENT',
      'SNAPSHOT'
    )
  ),

  document_no text,
  document_date date,

  customer_id bigint
    REFERENCES foliar_fertilizer.m_stock_customers(id)
    ON DELETE RESTRICT,

  reference_document_id bigint
    REFERENCES foliar_fertilizer.m_stock_documents(id)
    ON DELETE RESTRICT,

  source_group_code text,

  status text NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',
      'CONFIRMED',
      'CANCELLED'
    )
  ),

  note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ==================================================
-- 5. STOCK DOCUMENT LINES
-- ==================================================

CREATE TABLE foliar_fertilizer.r_stock_document_lines (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Document and item
  document_id bigint NOT NULL
    REFERENCES foliar_fertilizer.m_stock_documents(id)
    ON DELETE RESTRICT,

  line_no integer NOT NULL CHECK (line_no > 0),

  item_id bigint
    REFERENCES foliar_fertilizer.m_stock_items(id)
    ON DELETE RESTRICT,

  source_line_id bigint
    REFERENCES foliar_fertilizer.r_stock_document_lines(id)
    ON DELETE RESTRICT,

  -- Stock ownership
  owner_kind text NOT NULL DEFAULT 'UNKNOWN' CHECK (
    owner_kind IN (
      'COMPANY',
      'CUSTOMER',
      'UNKNOWN'
    )
  ),

  owner_customer_id bigint
    REFERENCES foliar_fertilizer.m_stock_customers(id)
    ON DELETE RESTRICT,

  -- Stock locations
  from_location_id bigint
    REFERENCES foliar_fertilizer.m_stock_locations(id)
    ON DELETE RESTRICT,

  to_location_id bigint
    REFERENCES foliar_fertilizer.m_stock_locations(id)
    ON DELETE RESTRICT,

  count_location_id bigint
    REFERENCES foliar_fertilizer.m_stock_locations(id)
    ON DELETE RESTRICT,

  -- Stock movement
  occurred_on date,
  quantity numeric CHECK (quantity > 0),
  unit text,
  reason_code text,

  -- Stock counting
  counted_qty numeric CHECK (counted_qty >= 0),
  book_qty_at_count numeric,

  -- Cost information
  unit_cost numeric,
  cost_amount numeric,
  packing_price numeric,
  packing_cost numeric,
  packing_fee numeric,
  packing_fee_cost numeric,
  weight_tonnes numeric,

  -- Excel source information
  source_file_name text,
  source_sheet_name text,
  source_cell_range text,
  source_data json,

  note text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE (document_id, line_no),

  CHECK (
    (
      owner_kind = 'CUSTOMER'
      AND owner_customer_id IS NOT NULL
    )
    OR
    (
      owner_kind IN ('COMPANY', 'UNKNOWN')
      AND owner_customer_id IS NULL
    )
  ),

  CHECK (from_location_id <> to_location_id)
);


-- ==================================================
-- 6. INDEXES
-- ==================================================

CREATE INDEX idx_m_stock_items_item_type
  ON foliar_fertilizer.m_stock_items (
    item_type
  );

CREATE INDEX idx_m_stock_documents_type_status_date
  ON foliar_fertilizer.m_stock_documents (
    document_type,
    status,
    document_date
  );

CREATE INDEX idx_m_stock_documents_so_group_date
  ON foliar_fertilizer.m_stock_documents (
    source_group_code,
    document_date
  )
  WHERE document_type = 'SO';

CREATE INDEX idx_r_stock_document_lines_item_date
  ON foliar_fertilizer.r_stock_document_lines (
    item_id,
    occurred_on
  );

CREATE INDEX idx_r_stock_document_lines_owner_customer
  ON foliar_fertilizer.r_stock_document_lines (
    owner_customer_id
  );


-- ==================================================
-- 7. DATABASE PERMISSIONS
-- ==================================================

REVOKE ALL ON TABLE
  foliar_fertilizer.m_stock_customers,
  foliar_fertilizer.m_stock_items,
  foliar_fertilizer.m_stock_locations,
  foliar_fertilizer.m_stock_documents,
  foliar_fertilizer.r_stock_document_lines
FROM PUBLIC;


REVOKE ALL ON SEQUENCE
  foliar_fertilizer.m_stock_customers_id_seq,
  foliar_fertilizer.m_stock_items_id_seq,
  foliar_fertilizer.m_stock_locations_id_seq,
  foliar_fertilizer.m_stock_documents_id_seq,
  foliar_fertilizer.r_stock_document_lines_id_seq
FROM PUBLIC;


GRANT USAGE ON SCHEMA foliar_fertilizer
TO foliar_fertilizer_app;


GRANT SELECT, INSERT, UPDATE ON TABLE
  foliar_fertilizer.m_stock_customers,
  foliar_fertilizer.m_stock_items,
  foliar_fertilizer.m_stock_locations,
  foliar_fertilizer.m_stock_documents,
  foliar_fertilizer.r_stock_document_lines
TO foliar_fertilizer_app;


GRANT USAGE ON SEQUENCE
  foliar_fertilizer.m_stock_customers_id_seq,
  foliar_fertilizer.m_stock_items_id_seq,
  foliar_fertilizer.m_stock_locations_id_seq,
  foliar_fertilizer.m_stock_documents_id_seq,
  foliar_fertilizer.r_stock_document_lines_id_seq
TO foliar_fertilizer_app;

COMMIT;