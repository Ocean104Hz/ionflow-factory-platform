BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(20261125, 1);
CREATE TABLE foliar_fertilizer.production_order_doc_no_counters (
 prefix text NOT NULL DEFAULT 'PRD' CHECK(prefix='PRD'),
 yy text NOT NULL CHECK(yy ~ '^[0-9]{2}$'),
 mm text NOT NULL CHECK(mm ~ '^(0[1-9]|1[0-2])$'),
 last_seq integer NOT NULL DEFAULT 0 CHECK(last_seq>=0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(prefix,yy,mm)
);
CREATE TABLE foliar_fertilizer.production_order_doc_no_reservations (
 id uuid PRIMARY KEY, doc_no text NOT NULL UNIQUE,
 prefix text NOT NULL DEFAULT 'PRD' CHECK(prefix='PRD'), yy text NOT NULL, mm text NOT NULL,
 seq integer NOT NULL CHECK(seq>0), status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','used')),
 reserved_by bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id),
 reserved_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
 used_at timestamptz, production_order_id uuid UNIQUE REFERENCES foliar_fertilizer.production_v1_documents(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(prefix,yy,mm,seq), FOREIGN KEY(prefix,yy,mm) REFERENCES foliar_fertilizer.production_order_doc_no_counters(prefix,yy,mm),
 CHECK(expires_at>reserved_at),
 CHECK(doc_no=prefix||'-'||yy||mm||lpad(seq::text,greatest(3,length(seq::text)),'0')),
 CHECK((status='reserved' AND used_at IS NULL AND production_order_id IS NULL) OR (status='used' AND used_at IS NOT NULL AND production_order_id IS NOT NULL))
);
CREATE INDEX production_order_doc_no_expiry_idx ON foliar_fertilizer.production_order_doc_no_reservations(prefix,yy,mm,seq,expires_at) WHERE status='reserved';
INSERT INTO foliar_fertilizer.production_order_doc_no_counters(prefix,yy,mm,last_seq)
SELECT 'PRD',substring(document_no from 5 for 2),substring(document_no from 7 for 2),max(substring(document_no from 9)::integer)
FROM foliar_fertilizer.production_v1_documents WHERE kind='order' AND document_no ~ '^PRD-[0-9]{2}(0[1-9]|1[0-2])[0-9]{3,}$'
GROUP BY 2,3;
GRANT SELECT,INSERT,UPDATE ON foliar_fertilizer.production_order_doc_no_counters,foliar_fertilizer.production_order_doc_no_reservations TO foliar_fertilizer_app;
COMMIT;
