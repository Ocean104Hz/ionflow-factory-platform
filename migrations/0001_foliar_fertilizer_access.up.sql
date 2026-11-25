BEGIN;

DO $$
BEGIN
  IF current_database() <> 'production' THEN
    RAISE EXCEPTION 'Migration must run on database production';
  END IF;
  IF current_user <> 'foliar_fertilizer_owner' THEN
    RAISE EXCEPTION 'Migration must run as foliar_fertilizer_owner';
  END IF;
  IF to_regnamespace('foliar_fertilizer') IS NULL THEN
    RAISE EXCEPTION 'Schema foliar_fertilizer does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'foliar_fertilizer_app') THEN
    RAISE EXCEPTION 'Runtime role foliar_fertilizer_app does not exist';
  END IF;
END $$;

CREATE TABLE foliar_fertilizer.app_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  firebase_uid text NOT NULL UNIQUE CHECK (firebase_uid ~ '^[[:alnum:]_-]{1,128}$'),
  email text NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND length(email) BETWEEN 3 AND 320),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE foliar_fertilizer.app_roles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE foliar_fertilizer.app_modules (
  module_key text PRIMARY KEY CHECK (module_key ~ '^[a-z][a-z0-9_]{1,99}$'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  group_key text NOT NULL CHECK (group_key ~ '^[A-Z][A-Z0-9 _-]{1,63}$'),
  href text NOT NULL UNIQUE CHECK (href ~ '^/[a-z0-9_/-]+$'),
  sort_order integer NOT NULL UNIQUE CHECK (sort_order > 0),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE foliar_fertilizer.app_user_roles (
  user_id bigint NOT NULL REFERENCES foliar_fertilizer.app_users(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES foliar_fertilizer.app_roles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE foliar_fertilizer.app_role_modules (
  role_id bigint NOT NULL REFERENCES foliar_fertilizer.app_roles(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES foliar_fertilizer.app_modules(module_key) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (role_id, module_key)
);

INSERT INTO foliar_fertilizer.app_modules(module_key,title,group_key,href,sort_order) VALUES
('dashboard','แดชบอร์ด','OVERVIEW','/dashboard',10),
('audit_log','ประวัติการแก้ไข','OVERVIEW','/audit_log',20),
('settings','ตั้งค่าระบบ','SYSTEM','/settings',30),
('pr','PR','PURCHASING','/pr',40),
('purchase_orders','PO','PURCHASING','/purchase-orders',50),
('production_orders','คำสั่งการผลิต','PURCHASING','/production-orders',60),
('qc_raw_material','ตรวจสอบวัตถุดิบ','QC','/qc_raw_material',70),
('fertilizer_powder_mixing','รายงานผสมปุ๋ยผง','QC','/fertilizer-powder-mixing',80),
('production_quality','ตรวจสอบคุณภาพการผลิต','QC','/production-quality',90),
('packaging_report','รายงานการบรรจุ','PACKING','/packaging-report',100),
('qc_organic_fertilizer','ตรวจคุณภาพปุ๋ยอินทรีย์เคมี','QC','/qc-organic-fertilizer',110),
('nc_reports','ใบ NC','QC','/nc-reports',120),
('sample_submissions','ใบส่งตัวอย่าง','QC','/sample-submissions',130),
('sample_submission_log','แบบบันทึกการนำเข้าส่งตัวอย่างวิเคราะห์','QC','/sample-submission-log',140),
('lab_sample_receiving','i-Lab แบบบันทึกรับตัวอย่าง','QC','/lab_sample_receiving',150),
('qc_product_weight_check','QC ตรวจเช็คน้ำหนักผลิตภัณฑ์','QC','/qc_product_weight_check',160),
('raw_material_receiving','รับวัตถุดิบและวัสดุ','WAREHOUSE','/raw-material-receiving',170),
('material_requisitions','เบิกวัสดุ/วัตถุดิบ','WAREHOUSE','/material-requisitions',180),
('material_issues','ใบเบิกจ่ายวัสดุ','WAREHOUSE','/material-issues',190),
('inventory','สินค้าคงคลัง','WAREHOUSE','/inventory',200),
('stock_products','สต็อกสินค้า','WAREHOUSE','/stock_products',210),
('stock_remaining_materials_ff','วัสดุคงเหลือ Foliar Fertilizer','WAREHOUSE','/stock_remaining_materials_ff',220),
('stock_wip_ff','สต็อก WIP Foliar Fertilizer','WAREHOUSE','/stock_wip_ff',230),
('stock_rm_ff','สต็อก RM Foliar Fertilizer','WAREHOUSE','/stock_rm_ff',240),
('product_production_orders_v1','ใบสั่งผลิตสินค้า V1','PRODUCTION','/product-production-orders-v1',250),
('bulk_production_orders','ใบสั่งผลิตสินค้า V2','PRODUCTION','/bulk-production-orders',260),
('bom','สูตรผสมวัตถุดิบ','PRODUCTION','/bom',270),
('production_reports','รายงานการผลิต','PRODUCTION','/production-reports',280),
('production_receipts_v1','ใบรับยอดผลิต V1','PRODUCTION','/production-receipts-v1',290),
('production_receipts','ใบรับยอดผลิต V2','PRODUCTION','/production-receipts',300),
('wip_receiving_issuing','บันทึกการรับ-จ่าย WIP','ORGANIC','/wip-receiving-issuing',310),
('organic_raw_material_receiving','ใบตรวจรับวัตถุดิบ/รับเข้าวัตถุดิบ','ORGANIC','/organic_raw_material_receiving',320),
('organic_extraction_temperature','บันทึกการใช้วัตถุสกัด/อุณหภูมิในการผลิต','ORGANIC','/organic_extraction_temperature',330),
('organic_extraction_material_ledger','บันทึกการรับ-จ่ายวัตถุดิบต้มสกัด','ORGANIC','/organic_extraction_material_ledger',340),
('effervescent_material_ledger','บันทึกการรับ-จ่ายวัตถุดิบเม็ดฟู่','ORGANIC','/effervescent_material_ledger',350),
('packing_summary','ใบแจ้งสั่งแพ็คสินค้า','PACKING','/packing-summary',360),
('delivery_orders','ใบส่งสินค้า','LOGISTICS','/delivery-orders',370),
('invoices','ใบแจ้งหนี้','SALES DOCUMENTS','/invoices',380),
('repair_requests','ใบแจ้งซ่อม','MAINTENANCE','/repair-requests',390),
('maintenance_work','งานของช่าง','MAINTENANCE','/maintenance-work',400),
('equipment','รายการอุปกรณ์','MAINTENANCE','/equipment',410),
('maintenance_reports','รายงานซ่อมบำรุง','MAINTENANCE','/maintenance-reports',420),
('products','สินค้าและราคากลาง','MASTER DATA','/products',430);

INSERT INTO foliar_fertilizer.app_roles(code,name,is_system) VALUES
('factory_admin','ผู้ดูแลระบบโรงงาน',true),
('factory_user','ผู้ใช้งานโรงงาน',true);

INSERT INTO foliar_fertilizer.app_role_modules(role_id,module_key)
SELECT r.id,m.module_key
FROM foliar_fertilizer.app_roles r
CROSS JOIN foliar_fertilizer.app_modules m
WHERE r.code='factory_admin';

INSERT INTO foliar_fertilizer.app_role_modules(role_id,module_key)
SELECT r.id,m.module_key
FROM foliar_fertilizer.app_roles r
JOIN foliar_fertilizer.app_modules m ON m.module_key='dashboard'
WHERE r.code='factory_user';

REVOKE ALL ON foliar_fertilizer.app_users, foliar_fertilizer.app_roles,
  foliar_fertilizer.app_modules, foliar_fertilizer.app_user_roles,
  foliar_fertilizer.app_role_modules FROM PUBLIC;
GRANT USAGE ON SCHEMA foliar_fertilizer TO foliar_fertilizer_app;
GRANT SELECT ON foliar_fertilizer.app_users, foliar_fertilizer.app_roles TO foliar_fertilizer_app;
GRANT INSERT(firebase_uid,email,display_name,is_active),
      UPDATE(email,display_name,is_active,last_login_at,updated_at)
ON foliar_fertilizer.app_users TO foliar_fertilizer_app;
GRANT INSERT(code,name,is_active),UPDATE(code,name,is_active,updated_at)
ON foliar_fertilizer.app_roles TO foliar_fertilizer_app;
GRANT SELECT ON foliar_fertilizer.app_modules TO foliar_fertilizer_app;
GRANT SELECT, INSERT, DELETE ON foliar_fertilizer.app_user_roles, foliar_fertilizer.app_role_modules TO foliar_fertilizer_app;
GRANT USAGE ON SEQUENCE foliar_fertilizer.app_users_id_seq,
  foliar_fertilizer.app_roles_id_seq TO foliar_fertilizer_app;

COMMIT;
