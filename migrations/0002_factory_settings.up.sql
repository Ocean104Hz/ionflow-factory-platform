BEGIN;

CREATE TABLE foliar_fertilizer.settings_masters (
  id text PRIMARY KEY,
  kind text NOT NULL,
  code text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, code)
);

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.settings_masters TO foliar_fertilizer_app;

CREATE TABLE foliar_fertilizer.factory_branding (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0)
);

CREATE TABLE foliar_fertilizer.purchasing_documents (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('pr','po')),
  document_no text NOT NULL,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  deleted boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX purchasing_document_number
  ON foliar_fertilizer.purchasing_documents (kind, lower(document_no));

CREATE TABLE foliar_fertilizer.purchasing_history (
  id uuid PRIMARY KEY,
  document_id text NOT NULL REFERENCES foliar_fertilizer.purchasing_documents(id),
  actor_id bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object')
);

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.factory_branding, foliar_fertilizer.purchasing_documents TO foliar_fertilizer_app;
GRANT SELECT, INSERT ON foliar_fertilizer.purchasing_history TO foliar_fertilizer_app;

COMMIT;
