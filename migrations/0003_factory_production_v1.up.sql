BEGIN;

CREATE TABLE foliar_fertilizer.production_bom (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE foliar_fertilizer.production_v1_documents (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('order','report','receipt')),
  document_no text NOT NULL,
  document_date date NOT NULL,
  order_id uuid REFERENCES foliar_fertilizer.production_v1_documents(id),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  actor_id bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
  saved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, document_no),
  CHECK ((kind = 'order') = (order_id IS NULL))
);
CREATE UNIQUE INDEX production_v1_report_per_order
  ON foliar_fertilizer.production_v1_documents (order_id) WHERE kind = 'report';
CREATE INDEX production_v1_documents_listing
  ON foliar_fertilizer.production_v1_documents (kind, document_date DESC, document_no DESC);

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.production_bom, foliar_fertilizer.production_v1_documents TO foliar_fertilizer_app;

UPDATE foliar_fertilizer.app_modules SET is_active=false
  WHERE module_key IN ('bulk_production_orders','production_receipts');

COMMIT;
