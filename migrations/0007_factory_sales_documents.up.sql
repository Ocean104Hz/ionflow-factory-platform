BEGIN;

CREATE TABLE foliar_fertilizer.hub_product_prices (
  company_id uuid NOT NULL,
  hub_product_id uuid NOT NULL,
  unit_price numeric(18,4) NOT NULL CHECK (unit_price > 0),
  unit_name text NOT NULL,
  updated_by text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, hub_product_id),
  FOREIGN KEY (company_id, hub_product_id)
    REFERENCES foliar_fertilizer.hub_products(company_id, hub_product_id)
);

CREATE TABLE foliar_fertilizer.hub_documents (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES foliar_fertilizer.hub_orders(id),
  kind text NOT NULL CHECK (kind IN ('DELIVERY_ORDER', 'INVOICE')),
  number text NOT NULL UNIQUE,
  period text NOT NULL,
  counter integer NOT NULL CHECK (counter BETWEEN 1 AND 9999),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  UNIQUE (order_id, kind),
  UNIQUE (kind, period, counter)
);

GRANT SELECT, INSERT, UPDATE ON foliar_fertilizer.hub_product_prices TO foliar_fertilizer_app;
GRANT SELECT, INSERT ON foliar_fertilizer.hub_documents TO foliar_fertilizer_app;

COMMIT;
