BEGIN;

CREATE TABLE foliar_fertilizer.hub_orders (
  id uuid PRIMARY KEY,
  hub_order_id uuid NOT NULL UNIQUE,
  route_id text NOT NULL UNIQUE,
  company_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  event_sequence integer NOT NULL DEFAULT 0,
  command jsonb NOT NULL,
  document jsonb NOT NULL,
  received_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE foliar_fertilizer.hub_commands (
  id uuid PRIMARY KEY,
  key_hash text NOT NULL UNIQUE,
  request_hash text NOT NULL,
  acknowledgement jsonb NOT NULL
);

CREATE TABLE foliar_fertilizer.hub_products (
  company_id uuid NOT NULL,
  hub_product_id uuid NOT NULL,
  version integer NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (company_id, hub_product_id)
);

CREATE TABLE foliar_fertilizer.hub_events (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES foliar_fertilizer.hub_orders(id),
  sequence integer NOT NULL,
  envelope jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING','SENDING','DELIVERED','FAILED')),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz,
  last_status integer,
  UNIQUE (order_id, sequence)
);

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.hub_orders, foliar_fertilizer.hub_products, foliar_fertilizer.hub_events TO foliar_fertilizer_app;
GRANT SELECT, INSERT ON foliar_fertilizer.hub_commands TO foliar_fertilizer_app;

COMMIT;
