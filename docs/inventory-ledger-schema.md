# Inventory Ledger — PostgreSQL Schema Blueprint

**Status: PROPOSED / NOT APPLIED — ต้องได้รับอนุมัติก่อนออกแบบ migration จริง**

เอกสารข้อเสนอสำหรับ PostgreSQL 18 development database `ionflow_inventory_dev` เท่านั้น งาน Step 2 ไม่ได้เชื่อมต่อฐานข้อมูล ไม่ได้ตรวจว่ามี schema/table ใดอยู่ ไม่ได้รัน SQL ติดตั้ง driver แก้ environment หรือสร้าง migration history

## ขอบเขตและแหล่งข้อมูล

- Step 2 มีเฉพาะประวัติ mock แบบอ่านอย่างเดียว ไม่มีคำสั่งรับ จ่าย โอน ปรับยอด จอง หรืออนุมัติ
- ระบบเดียวสำหรับ RAW / PACKAGING / WIP / FG / MRO / OTHER ส่วน legacy ที่ยังไม่ mapped เก็บสถานะแยก ไม่แปลงเป็น OTHER โดยอัตโนมัติ
- ประเภทสินค้า กลุ่มสินค้า หมวดสินค้า และ QC disposition เป็นคนละมิติ
- Immutable ledger events เป็นแหล่งความจริงของจำนวน Balance projection เป็นผลคำนวณที่สร้างใหม่ได้ ไม่ใช่ยอดให้ผู้ใช้แก้
- Factory Settings เป็นเจ้าของ Site / Warehouse / Unit / Category และ identity ที่เกี่ยวข้องในอนาคต ต้องยืนยัน ownership/schema จริงก่อนสร้าง FK ไม่สร้าง master production อีกชุดโดยพลการ
- Item master สำหรับ inventory ยังแยกจากทะเบียน/ราคา/SKU ของ Sales Hub ไม่มีการเชื่อม PR, BOM, QC, Production, Packing, Delivery หรือ Invoice ในขั้นนี้

## โครงสร้างเชิงตรรกะที่เสนอ

ชื่อด้านล่างเป็นชื่อประกอบการทบทวน ไม่ใช่ตารางที่มีอยู่หรือ DDL พร้อมรัน ทุกแถวต้องมี workspace/tenant scope เมื่อระบบ tenancy ได้รับอนุมัติแล้ว

| โครงสร้าง                | Key / ความสัมพันธ์                                | ข้อมูลสำคัญและเจ้าของ                                                                                                                                                            |
| ------------------------ | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory items          | Stable UUID; unique code ภายใน workspace          | canonical type nullable, legacy classification, group, category reference, specification, base unit reference, brand, reorder point, active; ยืนยันเจ้าของ master ก่อน implement |
| Site references          | Stable ID จาก Factory Settings                    | ใช้ authoritative master เดิม ไม่สร้างชื่อโรงงานเป็น primary key                                                                                                                 |
| Warehouse references     | Stable Settings ID; FK ไป Site แบบ scoped         | Warehouse ต้องอยู่ใน Site ที่ posting ระบุ                                                                                                                                       |
| Inventory locations      | UUID; FK ไป Warehouse และ Site                    | code unique ภายใน Warehouse; label เป็นข้อมูลแสดงผลที่เปลี่ยนได้                                                                                                                 |
| Inventory lots           | UUID; FK ไป Item                                  | Lot code unique ต่อ Item/workspace; รักษา case ตาม contract ที่ตกลง ห้ามเปลี่ยน case ระหว่างย้ายข้อมูลโดยไม่อนุมัติ                                                              |
| Inventory positions      | UUID; FK ไป Item, Site, Warehouse, Location, Lot  | เก็บ identity ของตำแหน่ง รวมตำแหน่งยอดศูนย์ที่ต้องคงไว้ ไม่มีคอลัมน์จำนวนให้ผู้ใช้แก้                                                                                            |
| Ledger events            | UUID; unique idempotency key ต่อ workspace/source | event type, posted_at, stable order, document number, reason, recorded_at, recorded_by, source reference                                                                         |
| Ledger postings          | UUID; FK ไป Event และ Position/stock key          | signed quantity_delta, unit reference; posting ต้องไม่เป็นศูนย์                                                                                                                  |
| Balance projections      | unique full stock key                             | quantity, last event/order, projection version, calculated_at; derived cache เท่านั้น                                                                                            |
| Ledger baseline metadata | หนึ่ง baseline ที่อนุมัติต่อ dataset/workspace    | supported_from, opening event ID, source/count evidence, checksum, scope; ไม่ใช่ยอดเพิ่มอีกชุด                                                                                   |

### Stable identifiers / stock key

Stock key = `(workspace, item, site, warehouse, location, lot, inventory_status)`

- UI mock ใช้ ID เดิมของ Item/Site/Warehouse ส่วน Location และ Lot ยังเป็นข้อความ exact จาก Step 1; serializer ใช้ JSON tuple เพื่อไม่ชนกันเมื่อข้อความมี separator
- ก่อนต่อฐานข้อมูลต้องมี mapping ที่ตรวจสอบได้จาก locationLabel/lotCode ไป UUID โดยไม่เปลี่ยน item identity, จำนวน หรือมิติ stock key เดิม
- Lot เดียวอาจอยู่หลาย Warehouse, Location และ QC statuses ได้ ยอดสรุป Lot แสดงแยกจาก storage positions
- ต้องกำหนดการจัดการสินค้าที่ไม่มี Lot ให้ชัดเจน: ถ้าใช้ nullable Lot FK uniqueness ต้องถือ NULL เป็นตำแหน่งเดียวกัน ห้ามปล่อยให้เกิด duplicate positions จาก NULL
- ไม่ใช้ชื่อสินค้า ชื่อคลัง หรือ label เป็น authoritative identifier ใน production

## Quantity precision

- เสนอ `NUMERIC(20,6)` ทั้ง signed posting quantity, reorder point และ projected quantity โดยไม่มี implicit unit conversion
- Mock ใช้ BigInt จำนวน micro-units (scale 1,000,000) บวก/ลบและตรวจ reconciliation แบบ exact รับจำนวนทศนิยมสูงสุด 6 ตำแหน่ง ปฏิเสธค่าละเอียดเกิน/NaN/Infinity ไม่ปัดเศษให้ผ่าน
- จำนวนทุก posting ต้องใช้ base unit ของ Item เดียวกัน การเปลี่ยน base unit ของ Item ที่มีประวัติต้องเป็นงาน migration แยกและได้รับอนุมัติ
- Existing Step 1 UI รับ number; adapter ตรวจ decimal → number → decimal ว่าค่าเดิมครบก่อนส่ง ถ้าเกินความแม่นยำจะปฏิเสธ ไม่ปัดเศษเงียบ ๆ การเก็บ/ส่งข้อมูล production ควรใช้ decimal strings ต่อเนื่องทั้ง contract
- ไม่รวม kg, ใบ, กระสอบ หรือสินค้าอื่นเข้าด้วยกันเป็นยอดเดียว การจัดกลุ่มและ reconciliation ต้องแยก Item/base unit

## Constraints และ invariants

1. Item, Site, Warehouse, Location และ Lot ต้องมี FK ที่ถูกต้อง และ composite relationships ต้องป้องกันการอ้างข้าม scope (Warehouse–Site, Location–Warehouse, Lot–Item)
2. Event ID / posting ID / idempotency key ต้อง unique; document number ต้องไม่ว่าง แต่ไม่ควร unique เพียงลำพังเพราะหนึ่งเอกสารอาจมีหลาย event types/ส่วนงาน
3. OPENING / RECEIPT มี posting บวก; ISSUE มี posting ลบ; ADJUSTMENT ต้องระบุเหตุผล; ทุก posting nonzero
4. TRANSFER รักษายอดแยก Item/Lot/QC status เปลี่ยนเฉพาะพื้นที่เก็บ; STATUS_CHANGE รักษายอดแยก Item/Site/Warehouse/Location/Lot เปลี่ยนเฉพาะ QC status ไม่เอายอดคนละ Item/หน่วยมาหักล้างกัน
5. Postings ของ event เดียวต้องยอมรับพร้อมกันทั้งหมด หลังรวม delta ต่อ stock key แล้วห้ามตำแหน่งใดติดลบ ไม่มี partial event
6. Multi-row conservation และ nonnegative chronological replay ไม่สามารถรับรองด้วย row-level CHECK เพียงอย่างเดียว ต้องออกแบบ transaction boundary, scoped locking และ server-side validation ใน Step 3 ที่ได้รับอนุมัติแล้ว
7. Ledger ที่ posted แล้วเป็น append-only; corrections ในอนาคตต้องมีเหตุการณ์ชดเชยพร้อม audit/reference ไม่แก้ประวัติเดิมหรือ projection ด้วยมือ
8. สถานะมี AVAILABLE, QC_HOLD, BLOCKED แยกจากประเภท Item; AVAILABLE ไม่เท่ากับ available-to-promise เพราะยังไม่มี reservations

## Idempotency, ordering และ atomicity

- เสนอ unique `(workspace_id, source_system, idempotency_key)` และ payload checksum; key เดิม payload ต่างกันต้อง error ไม่ overwrite
- ลำดับ replay: `posted_at ASC`, `posting_order ASC`, `event_id ASC` ทำให้เวลาที่เท่ากันมีลำดับแน่นอน ทั้ง mock และ schema contract ต้องใช้กฎเดียวกัน
- Mock มี opening event หนึ่งเหตุการณ์ต่อ dataset พร้อม ID คงที่ การ initialize เป็น pure construction/replay ไม่ append เข้า React state การส่ง event ซ้ำถูกปฏิเสธ
- อนาคตการโพสต์ event และ postings ทั้งหมด รวม checkpoint/projection update ต้องอยู่ใน transaction เดียว โดย lock stock keys ตามลำดับคงที่เพื่อจำกัด race/deadlock
- การลงย้อนหลังในอนาคตต้อง validate/reproject ช่วงเวลาถัดไปทั้งหมด ห้ามตรวจแค่ยอดปัจจุบันแล้วปล่อยประวัติช่วงกลางติดลบ เรื่องนี้ยังไม่ implement ใน Step 2

## Opening balance / mock reconciliation

- Step 1 มี 16 Items และ 21 stock positions เป็น known current fixtures ซึ่งเก็บเดิมทุกค่าไว้สำหรับตรวจสอบ
- ประวัติ mock 11 เหตุการณ์ถูกกำหนดก่อน จากนั้น opening ต่อ stock key = target Step 1 − net historical postings โดยตรวจว่า opening ไม่ติดลบ และทุก temporary key ต้องคืนยอดศูนย์
- มี opening event อีก 1 เหตุการณ์ รวมทั้งหมด 12 events; zero posting ไม่ถูกสร้าง ตำแหน่ง `b07` คงไว้ผ่าน identity registry โดยไม่เติม adjustment
- ตำแหน่งชั่วคราวที่เคยมี stock แต่คืนศูนย์และไม่อยู่ registry เดิม จะไม่เพิ่มเป็น current position หลอก ๆ แต่ยังย้อนดูผ่านประวัติ/as-of ได้
- Snapshot quantities ไม่ถูกนำมาบวกซ้ำหลัง replay; Explorer อ่านเฉพาะ ledger projection เปรียบเทียบ Step 1 ด้วย full key เท่านั้น
- Reconciliation แยก matching / missing / unexpected / quantity differences; mismatch ต้องรายงาน ห้ามเขียนทับ source fixtures เพื่อให้ผ่าน
- ประวัติเหล่านี้ถูกสร้างเพื่อสาธิตจากยอดที่รู้แล้ว ไม่ใช่หลักฐาน provenance จริงของสินค้าหรือเอกสารจากโรงงาน
- Production baseline ในอนาคตต้องมาจาก opening/count evidence ที่รับรอง มี cutoff/freeze และ checksum ไม่สร้างย้อนหลังโดยอิงยอดปลายทางตามตัวอย่าง mock นี้

## Historical date contract

- Business timezone: **Asia/Bangkok (UTC+07:00)**
- วันที่อย่างเดียวหมายถึงรวม posting จน `23:59:59.999` ของวันนั้นตามเวลาไทย; timestamp ต้องมี timezone ชัดเจน ไม่ใช้ timezone ของเครื่องผู้ใช้
- Mock timestamps มีความละเอียดระดับ millisecond; ฝั่ง PostgreSQL ในอนาคตเสนอใช้ `TIMESTAMPTZ` และขอบเขตน้อยกว่าเวลาเริ่มวันถัดไปตาม Bangkok เพื่อรวมทั้งวันได้ครบแม้ข้อมูลมี microseconds ไม่ตัดทิ้งที่ `.999` โดยไม่ตั้งใจ
- supported opening ของ demo คือ **1 ต.ค. 2026 เวลา 08:00 น. ไทย** คำขอก่อนหน้านั้นแสดงว่าไม่มีช่วงประวัติรองรับ ไม่อ้างว่ายอดเป็นศูนย์
- As-of มาจาก replay events ถึง cutoff ไม่ได้อนุมานจาก current snapshot; ส่วนต่างที่แสดง = current − historical ภายใต้ filters/scope เดียวกัน
- กรณีไม่มี event แสดงว่าไม่มีข้อมูล/baseline ให้ยืนยัน ไม่สร้างยอดประวัติขึ้นเอง

## Index proposals

- Events: unique idempotency scope, chronological composite `(workspace, posted_at, posting_order, event_id)`, document reference lookup
- Postings: `(workspace, item, event)`, `(workspace, warehouse, event)`, `(workspace, lot, event)`; FK indexes ให้การ trace source/destination ทำงานได้ทั้งสองฝั่ง
- Positions/projections: unique full stock key พร้อม indexes สำหรับ `(workspace, site, warehouse, item)` และ `(workspace, item, lot, inventory_status)`
- Item code และ Lot code lookup แยกจาก free-text item/specification search; เลือก index strategy จริงหลังประเมิน query/volume ไม่ติดตั้ง extension ในงานนี้

## Audit / security / ownership boundary

- เก็บ recorded_by, recorded_at, posted_at, source_system, source_document, reason, idempotency key และ schema/projection version โดยใช้ identity จากระบบจริงเมื่อได้รับอนุมัติ
- UI filters ไม่ใช่ authorization; production ต้องตรวจ tenant/site access ที่ backend และใน scoped FK/query ไม่มีการสร้าง bypass หรือสิทธิ์ใหม่ใน Step 2
- Settings master integration ต้องยืนยัน owner และ policy ของ inactive/renamed masters; history ควรรักษา stable IDs และ display snapshots ไม่อาศัยชื่อปัจจุบันอย่างเดียว
- Event references ไป PR/BOM/QC/Production/Packing/Delivery เป็นเพียงขอบเขตสัญญาอนาคต ไม่ได้เรียก API หรือเปลี่ยน workflow ใด

## Migration / rollback considerations — future approval required

1. ตรวจ schema จริงแบบ read-only และตกลง ownership/tenant/identifier mapping กับผู้ใช้ก่อนเขียน migration
2. ออกแบบ non-destructive schema additions และ baseline import dry-run ที่ตรวจ unit, duplicates, references และ stock keys ให้ครบ
3. รัน deterministic replay/reconciliation เทียบ approved opening/current evidence พร้อมรายงานตำแหน่งผิด ห้าม cut over หากไม่ตรง
4. Freeze source ชั่วคราว กำหนด high-water mark และ idempotent cutover plan; ทดสอบ concurrency/replay และ backup/restore แยกจาก UI phase
5. Rollback ต้องสามารถกลับไป reader/version เดิมและ rebuild projection ได้ โดยไม่ลบ posted events หรือเขียนทับหลักฐานเดิม; destructive rollback ต้องอนุมัติแยก

**ไม่ได้สร้างหรือรัน migration/SQL/connection ใด เอกสารทั้งหมดนี้ยังเป็น PROPOSED / NOT APPLIED**

## Step 3 command semantics — PROPOSED / NOT APPLIED

- UI demo เพิ่มเฉพาะ RECEIVE / ISSUE / TRANSFER / ADJUST ผ่าน command validation และ replay เดิม โดยไม่แก้ baseline 12 events / 21 positions หรือเขียน snapshot quantities
- Provider ใน Factory Layout เก็บ immutable events ในหน่วยความจำเท่านั้น; commit ใช้สถานะล่าสุดแบบ synchronous, ไม่ทำ side effect ใน React state updater, navigation คง state และ full reload เริ่ม baseline ใหม่
- Idempotency key เดียว + payload เดิมคืน event เดิม; payload ต่างต้อง conflict; operation namespace ใช้เอกสาร RCV-/ISS-/TRF-/ADJ- ไม่ซ้ำ ไม่มี reversal/edit/delete
- รับเข้าเริ่ม QC_HOLD; เบิกได้เฉพาะ AVAILABLE ของ full stock key ที่เลือก; โอนภายใน Site เท่านั้นและรักษา Lot/unit/status; ปรับยอดต้องมีเหตุผลและ reviewed quantity ตรงกับยอดล่าสุด
- Form timestamp เป็นเวลาที่เตรียมคำสั่ง; event timestamp ไม่น้อยกว่า event ล่าสุด และ order เพิ่มเสมอ เพื่อให้หลายฟอร์มที่เปิดก่อนหน้ากันยัง append ตามลำดับ commit ไม่ย้อนหลัง
- Lot ที่สร้างจาก operation ยังคงตำแหน่งศูนย์ใน projection หลังเกิด event แรก; การย้อนก่อน event ไม่สร้าง Lot ดังกล่าวขึ้นมา
- ตำแหน่งจัดเก็บใน Step 3 ใช้ identity-only fixture registry ตามคลัง ไม่ใช่การสร้าง Master Data ซ้ำ; การเชื่อม Settings locations และ business documents รออนุมัติภายหลัง
- Production ในอนาคตยังต้องออกแบบ database transaction/locking, scoped unique idempotency + payload fingerprint, unique document constraint และ concurrent balance validation ภายใน transaction เดียว ก่อนใช้กับผู้ใช้หลายคนจริง
- ไม่มี SQL, migration, driver, credentials หรือการเข้าถึง PostgreSQL ใน Step 3 นี้
