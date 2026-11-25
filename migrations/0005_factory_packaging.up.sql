BEGIN;

CREATE TABLE foliar_fertilizer.packaging_reports (
  id uuid PRIMARY KEY,
  profile_id text NOT NULL CHECK (profile_id IN ('ITECH','IFOAM')),
  document_no text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  actor_id bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX packaging_reports_document_no
  ON foliar_fertilizer.packaging_reports (profile_id, lower(document_no))
  WHERE deleted_at IS NULL AND document_no <> '';

CREATE TABLE foliar_fertilizer.packing_summaries (
  id uuid PRIMARY KEY,
  document_no text NOT NULL UNIQUE,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  actor_id bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id)
);

CREATE TABLE foliar_fertilizer.packing_summary_reports (
  summary_id uuid NOT NULL REFERENCES foliar_fertilizer.packing_summaries(id),
  report_id uuid PRIMARY KEY REFERENCES foliar_fertilizer.packaging_reports(id)
);
CREATE INDEX packing_summary_reports_summary ON foliar_fertilizer.packing_summary_reports (summary_id);

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.packaging_reports, foliar_fertilizer.packing_summaries TO foliar_fertilizer_app;
GRANT SELECT, INSERT, DELETE ON foliar_fertilizer.packing_summary_reports TO foliar_fertilizer_app;

COMMIT;
