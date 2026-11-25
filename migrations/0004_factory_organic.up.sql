BEGIN;

CREATE TABLE foliar_fertilizer.organic_documents (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN (
    'wip_receiving_issuing', 'organic_raw_material_receiving',
    'organic_extraction_temperature', 'organic_extraction_material_ledger',
    'effervescent_material_ledger'
  )),
  document_date date NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  actor_id bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz
);

CREATE INDEX organic_documents_history ON foliar_fertilizer.organic_documents
  (kind, document_date DESC, updated_at DESC) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX organic_documents_daily_form ON foliar_fertilizer.organic_documents
  (kind, document_date) WHERE deleted_at IS NULL
  AND kind IN ('wip_receiving_issuing', 'organic_raw_material_receiving');

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.organic_documents TO foliar_fertilizer_app;

COMMIT;
