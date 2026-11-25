BEGIN;

CREATE TABLE foliar_fertilizer.qc_documents (
  id uuid PRIMARY KEY,
  kind text NOT NULL REFERENCES foliar_fertilizer.app_modules(module_key),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (kind IN ('qc_organic_fertilizer','nc_reports','sample_submissions','sample_submission_log','lab_sample_receiving','qc_product_weight_check'))
);
CREATE INDEX qc_documents_current ON foliar_fertilizer.qc_documents (kind, updated_at DESC, id) WHERE deleted_at IS NULL;

CREATE TABLE foliar_fertilizer.qc_audit (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES foliar_fertilizer.qc_documents(id),
  actor_id bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX qc_audit_latest ON foliar_fertilizer.qc_audit (occurred_at DESC, id DESC);

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.qc_documents TO foliar_fertilizer_app;
GRANT SELECT, INSERT ON foliar_fertilizer.qc_audit TO foliar_fertilizer_app;

COMMIT;
