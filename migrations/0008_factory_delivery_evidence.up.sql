BEGIN;

ALTER TABLE foliar_fertilizer.hub_documents ADD COLUMN status text NOT NULL DEFAULT 'DRAFT'
  CHECK (status IN ('DRAFT','SUBMITTED','PICKED_UP','ISSUED','CANCELLED'));
UPDATE foliar_fertilizer.hub_documents SET status='ISSUED' WHERE kind='INVOICE';
ALTER TABLE foliar_fertilizer.hub_documents ADD CONSTRAINT hub_documents_kind_status
  CHECK ((kind='INVOICE' AND status IN ('ISSUED','CANCELLED')) OR
    (kind='DELIVERY_ORDER' AND status IN ('DRAFT','SUBMITTED','PICKED_UP')));
GRANT UPDATE (status) ON foliar_fertilizer.hub_documents TO foliar_fertilizer_app;

CREATE TABLE foliar_fertilizer.hub_delivery_evidence (
  id uuid PRIMARY KEY,
  delivery_id uuid NOT NULL REFERENCES foliar_fertilizer.hub_documents(id),
  category text NOT NULL CHECK (category IN ('DRIVER_ID_DOCUMENT','DRIVER_PHOTO','VEHICLE_PHOTO')),
  mime_type text NOT NULL,
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 5242880),
  UNIQUE (delivery_id, category)
);
GRANT SELECT, INSERT ON foliar_fertilizer.hub_delivery_evidence TO foliar_fertilizer_app;

COMMIT;
