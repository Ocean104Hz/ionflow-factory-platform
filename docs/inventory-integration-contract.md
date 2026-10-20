# Inventory Step 4 integration contract

**PROPOSED / NOT IMPLEMENTED** สำหรับการเชื่อมโมดูลจริง / APIs / backend / database

สิ่งที่ implement แล้วใน Step 4 คือ strictly typed mock contracts, pure read-only preview engine, fictional scenarios และมุมมองตัวอย่างใน `/inventory` เท่านั้น ไม่ใช่ cross-module posting integration

## Architecture / ownership

Future: Business document → confirmed physical milestone → validated command → existing Inventory Ledger → projection

Current: Fictional scenario → typed contract → replay current events (read-only) → proposed postings / before-delta-after → display

ดู source audit, สถานะ implemented/placeholder และ posting milestone matrix ที่ [inventory-integration-matrix.md](./inventory-integration-matrix.md) ซึ่งเป็นส่วนของสัญญานี้

Inventory เป็นเจ้าของยอดและประวัติ immutable เพียงรายเดียว ไม่ใช้ balances จาก PR, BOM, Mixing catalog หรือ source documents เป็น stock store อีกชุด และไม่ปรับ opening balances เพื่อให้ integration ผ่าน

## Canonical payload และ field identities

`inventory-integration-contracts.ts` กำหนด:

- SourceDocumentReference เป็น discriminated union: sourceModule ตรงกับ sourceDocumentType; มี sourceApplication, workspaceId, stable document ID, human number, optional line/allocation ID, optional approved posting revision, businessMilestone
- InventoryReference reuse StockPosition โดยไม่ใช้ snapshot quantity/id: itemId, siteId, warehouseId, locationLabel, lotCode, inventoryStatus, unit (= Item base unit)
- Intent / ProposedStockEffect: NONE, RECEIPT, ISSUE, QC_STATUS_CHANGE หรือ MANUFACTURING_CONVERSION; exact quantities เป็น decimal string ≤6 ตำแหน่ง ไม่ใช้ float เป็นเครื่องคิดเลข และไม่มี unit conversion
- Stock-affecting actions ต้องมี stable sourceLineId/allocation ID และ physicalMovementId; ห้ามใช้ array index ของ OrderItem หรือ BOM component เป็น identity ถาวร
- Intent amount ต้องเป็นบวก; QC disposition มีสอง signed proposals ในเอกสารเดียว; StockPosting format reuse Step 2 แต่ไม่ได้สร้าง StockLedgerEvent หรือ append ลง provider
- Result union: NO_STOCK_EFFECT / READY_TO_PREVIEW / BLOCKED / DESIGN_PENDING พร้อม source/effect, proposedPostings, before/delta/after, warnings/blockingReasons และ `postingSupported: false` เสมอ ไม่มี POSTED state

ตัวอย่างที่เป็นเพียง concept (ไม่ใช่ API ที่เปิดใช้งาน): workspace-demo, factory-preview-demo, MATERIAL_ISSUE / MATERIAL_ISSUE, document ID fictional:material-issue, line mock-allocation-1, ISSUE_CONFIRMED, physical movement fictional-movement:material-issue, Inventory item raw-a / wh-1 / DEMO-LOT-A / AVAILABLE, quantity "300" กิโลกรัม

แยก sourceLifecycle (คำอธิบาย) จาก evidence flag; HYPOTHETICAL_CONFIRMED ใน fixture ไม่ใช่สถานะใหม่ของ PR/QC/Delivery จริง หรือคำรับรองว่า actor มีสิทธิ์

## Idempotency และ single posting ownership

Stable key v1 เป็น JSON tuple ของ workspace, source application, document type, stable document ID, line/allocation ID, posting milestone และ approved posting revision (ถ้ามี) ไม่ใช้ human document number เป็น identity

- เปลี่ยนเลขแสดงผลไม่ควรสร้าง movement ใหม่; revision ไม่ใช่ document edit counter ทุกครั้ง การแก้เอกสารหลัง posted ต้องมี correction policy แยก ไม่ bump revision เพื่อหลบ duplicate guard
- Fingerprint ผูก source key + evidence + physical movement + effect + full stock key/unit + canonical exact quantity + target QC status; ไม่ขึ้นกับชื่อ scenario หรือลำดับ object properties
- Same key/same payload: future backend คืนผล event เดิมโดยไม่โพสต์ซ้ำ; mock preview แสดง BLOCKED / DUPLICATE_ACTION เพราะรายการตัวอย่างนี้อยู่ใน read-only known-action evidence แล้ว ไม่อ้างว่าได้ posted ใน Ledger เซสชันจริง
- Same key/different payload: IDEMPOTENCY_CONFLICT ห้าม override, retry โดยเปลี่ยน key หรือ silent repost
- Different source key/same physical movement: DUPLICATE_MOVEMENT; source action identity อย่างเดียวไม่พอป้องกัน DO/Goods Issue หรือ Mixing/Material Issue ซ้ำ ต้องแชร์ physical movement identity และอนุมัติ owner เดียวต่อการเคลื่อนไหว
- KnownSourceAction fixtures เป็นหลักฐานสังเคราะห์สำหรับทดสอบเท่านั้น ไม่ใช่ ledger/source-action registry อีกชุดที่แก้ไขได้
- Manual Step 3 ยังไม่ถูกแก้ และไม่มี physicalMovementId/source references แบบใหม่: ก่อนเชื่อมจริงต้องตัดสิน policy ให้ manual correction/receiving ที่อ้างเอกสารใช้ movement identity เดียวกัน ไม่ให้ bypass single-owner constraint

## QC / Lot / warehouse traceability

- Receiving ไม่เท่ากับ QC approval; preview receipt ตัวอย่างใช้ QC_HOLD แต่ real policy ต้องระบุว่าสินค้าชนิดใดต้องตรวจ ไม่ถือว่าทุก receipt ต้อง QC
- QC inspection finalized/pass/fail ในปัจจุบันยังไม่ใช่ stock release authorization ต้องมี final disposition, exact item/site/warehouse/location/Lot, affected qty, stable allocation, authorized actor และเวลายืนยัน
- Proposed QC_HOLD debit + AVAILABLE/BLOCKED credit ต้องรักษา item/Lot/unit/location และยอดรวม ไม่มีการสร้าง quantity จากผล QC
- Normal ISSUE ต้อง AVAILABLE ของตำแหน่งที่ระบุเท่านั้น ไม่ยืม stock จาก Lot อื่นหรือปล่อย QC_HOLD/BLOCKED
- Full key คือ item/site/warehouse/location/Lot/status; Lot เดียวกระจายหลายสถานที่/สถานะได้ ห้าม aggregate แล้วเบิกข้าม keys โดยไม่จัด allocation
- Locations ใน mock ใช้ inventory fixture registry ไม่ใช่ Settings Location master จริง; ต้อง resolve IDs ผ่าน approved mappings ก่อนใช้งานจริง

## Production / BOM / Packing / Dispatch

- BOM master/version/default selection เป็น planned requirements ไม่ deduct; ถ้าจะคำนวณความต้องการภายหลังต้องระบุสูตร revision, batch scaling, item/unit mappings และ shortage preview แยกจาก actual issue
- Material Issue เป็น recommended consumption evidence owner; Mixing เก็บ usage evidence/rounds และ production Lot traceability แต่ save ไม่ deduct ซ้ำ
- Production Receipt เป็น recommended WIP/FG output owner; ยังไม่มี module/lifecycle ต้องกำหนด completed output evidence + unique line allocation และห้ามนับซ้ำผ่าน production report/Packing
- Packing conversion ใช้หลาย input/output ต่าง item/หน่วยได้ ไม่ใช่ warehouse transfer ไม่ sum ตัวเลข kg + ใบ + กระสอบ และไม่ทำ global quantity conservation ข้ามหน่วย ต้องตกลง recipe, yield, losses, packaging quantity, output Lots, atomic command/rollback ก่อน implement
- Delivery draft/ready/print และ invoice ไม่ deduct; physical dispatch ต้องเลือก Goods Issue หรือ dispatch action เพียงหนึ่ง owner ก่อน implementation; current พร้อมส่ง/ส่งข้อมูลแล้วไม่เท่ากับ physical dispatch
- Financial invoice cancellation ไม่สร้าง stock reversal อัตโนมัติ; source cancellation/revision หลัง posting ต้องมี workflow/correction contract แยกที่ยังไม่ได้อนุมัติ

## Validation / errors / stale data / retry

Pure preview อ่าน immutable events กับ LedgerContext ผ่าน replayLedger เดิม จากนั้นตรวจ source, policy, mappings, unit, exact amount, stock availability และ known source actions ก่อนคืนผล ไม่เรียก commitStockOperation/createStockSession หรือแก้ provider

Missing source ID/required line/Lot/item/warehouse, site mismatch, wrong unit, held/blocked issue, shortage, duplicate action/conflicting payload และ stale expectedLedgerVersion → BLOCKED; unknown lifecycle/milestone หรือ unsupported conversion → DESIGN_PENDING; no-stock documents → NO_STOCK_EFFECT

Preview ใช้ current projection ที่ได้รับทุกครั้ง ไม่ใช้ fixture quantity เป็นยอดปัจจุบัน; optional expectedLedgerVersion เป็น full deterministic read watermark สำหรับ stale detection ใน demo เท่านั้น ไม่ใช่ cryptographic token หรือ production concurrency guarantee

Future backend ต้อง reread stock/document lifecycle/permissions ภายใน transaction ที่จะ post ห้ามเชื่อ before/after จาก browser หรือใช้ READY_TO_PREVIEW เป็น approval

Future retries: success/commit-but-response-lost คืน event เดิมจาก idempotency record; rejected command ไม่สร้าง postings; transient failure retry same stable key/payload หลังตรวจ authorization ใหม่; conflict/stale ให้มนุษย์ทบทวน ห้ามเปลี่ยน keyเพื่อให้ผ่าน; multi-posting action commit all-or-nothing ไม่มี partial transfer/status change

ไม่มี network retries, workers, queues, actual event publishers หรือ consumers ใน Step 4

## Authorization / audit / future API boundaries

Real source submit/confirmed-action adapter ต้อง resolve authenticated actor, tenant/site/warehouse permission, final milestone และ source revision จาก authoritative server ไม่รับจาก client assertions

Inventory boundary ต้อง validate full payload, ownership/physical movement uniqueness, unit precision, stock และ idempotency พร้อมเก็บ immutable actor/time/source/line/milestone/fingerprint/evidence references และ projected event linkage เพื่อ reconciliation

Proposed commands: confirmed receipt → existing RECEIVE; confirmed issue/dispatch → existing ISSUE; QC disposition และ conversion ต้องมี separately approved specialized domain commands ก่อนเชื่อม ไม่เพิ่มคำสั่งใหม่ให้ Step 3 ตอนนี้

ไม่มี endpoint, auth bypass, API integration หรือ backend stock authorization ที่ implement ใน phase นี้ Mock UI ไม่ใช่ RBAC จริง

## PostgreSQL strategy — PROPOSED / NOT IMPLEMENTED

ฐานข้อมูล `ionflow_inventory_dev` ไม่ถูกเข้าถึง ไม่มี SQL/DDL/migration/driver/credentials/config changes

Future schema ให้รักษา stable source document/line/action refs, tenant-scoped unique idempotency + fingerprint, movement owner uniqueness, immutable events/postings, Lot/location/status keys, NUMERIC(20,6), all-or-nothing transaction, site isolation, audit และ rebuildable/reconciled projections ตาม blueprint เดิม [inventory-ledger-schema.md](./inventory-ledger-schema.md)

ห้ามสร้าง master tables ซ้ำโดยไม่ตกลง Settings/Item ownership; เริ่มด้วย approved identity mapping, schema review และ migration dry run ที่ตรวจ opening + current evidence; migrate non-destructively, กำหนด cutoff/checkpoint, verify duplicate/quantity conservation และ reconciliation ก่อน cutover; rollback ต้องไม่ลบ posted evidence หรือ rewrite opening เพื่อปิดส่วนต่าง

เอกสาร Step 4 นี้ไม่เปลี่ยน blueprint เดิมเป็น active DB contract

## Unresolved decisions และลำดับทำงานถัดไป

1. อนุมัติ internal Inventory Item ownership และ explicit Sales SKU/BOM/material/catalog mappings รวม base-unit policy และ stable source line IDs
2. อนุมัติ warehouse/site/location IDs และ scope policy โดยไม่เอา isolated east fixtures เป็น production masters
3. สร้าง/อนุมัติ receiving, material issue, output receipt และ physical dispatch milestones/owners; ตกลงว่ามีการตรวจ QC ตอนไหน ใคร authorize และอนุญาต partial allocations อย่างไร
4. กำหนด shared physical movement identity ระหว่าง manual และ document-driven stock, correction/cancellation/revision policy และ duplicate race rules
5. ออกแบบ conversion contract ต่าง item/หน่วย แยกจาก transfer
6. ขออนุมัติงาน backend/DB/API phase ใหม่ แล้วค่อยออกแบบ transaction/idempotency storage/authorization, focused integration tests และ cutover/reconciliation

ยังไม่ได้อนุมัติหรือ implement ขั้นตอนอนาคตเหล่านี้ ไม่มี cross-module stock write ใน Step 4
