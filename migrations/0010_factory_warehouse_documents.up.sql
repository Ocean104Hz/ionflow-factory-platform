BEGIN;

CREATE TABLE foliar_fertilizer.warehouse_receipts (
  document_no text PRIMARY KEY,
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  sequence integer NOT NULL CHECK (sequence > 0),
  receive_date date NOT NULL,
  token uuid NOT NULL UNIQUE,
  reserved_by bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
  reserved_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL CHECK (expires_at > reserved_at),
  payload jsonb,
  updated_at timestamptz,
  updated_by bigint REFERENCES foliar_fertilizer.app_users(id),
  UNIQUE (period, sequence),
  CHECK ((payload IS NULL AND updated_at IS NULL AND updated_by IS NULL) OR
    (jsonb_typeof(payload) = 'object' AND updated_at IS NOT NULL AND updated_by IS NOT NULL))
);
CREATE INDEX warehouse_saved_receipts ON foliar_fertilizer.warehouse_receipts (updated_at DESC, document_no) WHERE payload IS NOT NULL;

CREATE TABLE foliar_fertilizer.warehouse_requisitions (
  id uuid PRIMARY KEY,
  document_no text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL,
  updated_by bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX warehouse_requisition_number ON foliar_fertilizer.warehouse_requisitions (lower(document_no)) WHERE deleted_at IS NULL;
CREATE INDEX warehouse_active_requisitions ON foliar_fertilizer.warehouse_requisitions (updated_at DESC, id) WHERE deleted_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.warehouse_receipts, foliar_fertilizer.warehouse_requisitions TO foliar_fertilizer_app;

COMMIT;
