# Inventory integration ownership matrix

ตรวจจาก LOCAL working tree วันที่ 19 ต.ค. 2026 รวมงาน uncommitted Steps 1–3 ไม่ใช้ remote main เป็นหลักฐาน

**PROPOSED / NOT IMPLEMENTED:** จุด posting และ integration ทั้งหมดในเอกสารนี้เป็นข้อเสนอ ยังไม่มีการต่อ save handler ของโมดูลใดเข้ากับ Inventory

## สถานะและแหล่งหลักฐาน

| โมดูล | แหล่ง source ที่ตรวจ | สิ่งที่มีจริง / identity / lifecycle | ข้อมูลอ้างอิงสต็อกและสิ่งที่ขาด |
|---|---|---|---|
| PR | `src/features/purchase-requisitions/pr-domain.ts`, `pr-provider.tsx` | PR `id`, `number`, `revision`; PRItem `id`; draft → pending_approval → approved/rejected; cancelled, partial_po_created, fully_po_created, closed ตาม domain | items code/name/quantity/unit; warehouseCode/Name; masterRefs เก็บ warehouse/unit snapshots แต่ไม่ใช่ Inventory Item mapping; ไม่มี Lot/location/QC position |
| PO | `DemoPO` และ `createDemoPO` ใน `pr-domain.ts`; `src/lib/constants/navigation.ts` | มี mock PO ที่สร้างภายใน PR: id/number/at/actor, lines.itemId/quantity; line itemId อ้าง PRItem ไม่ใช่ InventoryItem; ไม่มีหน้า PO หรือ receiving lifecycle | คำสั่งซื้อไม่ใช่ goods receipt; ห้ามอ้างว่ามี PO workflow สมบูรณ์ |
| รับวัตถุดิบ/รับตรง | navigation placeholder ไม่มี href และไม่มี feature/route ที่ลงมือรับสินค้า | ไม่ implemented | ต้องกำหนดเอกสารรับ, stable line, qty/unit, site/warehouse/location/Lot/disposition และ physical receipt confirmation ก่อน |
| BOM | `src/features/bom/bom-domain.ts`, `bom-provider.tsx` | Master.id/code/unit; Formula.id/masterId/code/version/status DRAFT/ACTIVE/INACTIVE; components.materialId/quantity/unit/remarks; ไม่มี component row ID แยก | เป็น BOM master IDs ไม่ใช่ Inventory IDs; มี default formula/version แต่ไม่มี physical issue; component allocation identity และ explicit mapping ยังขาด |
| เบิกวัตถุดิบ/เบิกการผลิต | navigation placeholder ไม่มี href/feature | ไม่ implemented | แนะนำเป็นเจ้าของการตัดวัตถุดิบเมื่อยืนยันจ่ายจริง; ต้องตกลง workflow/line allocation/Lot/หน่วย/stock key |
| Mixing | `src/features/fertilizer-powder-mixing/mixing-domain.ts`, `mixing-provider.tsx` | MixingReport.id/doc_no; material.id, material_code/name, lot_no, order_qty, unit, stock_balance; report_date, shift, location, loader_no; rounds.is_pass boolean/null; ไม่มี document approval/posting lifecycle | order_qty เป็นแผนผสม ไม่ใช่ actual consumption; stock_balance เป็นข้อมูลแค็ตตาล็อกสาธิต ไม่ใช่ Ledger อีกชุด; site/warehouse/item mapping และ issue reference ยังไม่มี |
| คำสั่งผลิต | `src/lib/mock-data/index.ts` (`ProductionOrder`, `OrderItem`), `src/features/production-orders/production-order-detail.tsx`, `src/components/factory/demo-provider.tsx` | id/number/revision/source Sales Hub หรือ Datalink; OrderItem.sku ไม่มี stable line ID; document/material/approval/production แยกสถานะ | warehouse เป็นข้อความ; items quantity/unit เป็น Sales SKU ไม่ใช่ Inventory Item; ไม่มี output Lot/location/confirmed receipt; ไม่แก้ inbound/outbound Sales Hub |
| รับยอดผลิต | navigation placeholder ไม่มี href/feature | ไม่ implemented | ต้องกำหนด output receipt document/line; สถานะ “ผลิตเสร็จแล้ว”, “พร้อมรับสินค้า”, “รับสินค้าแล้ว” ของคำสั่งผลิตไม่ใช่หลักฐานลง stock receipt |
| QC วัตถุดิบ | `src/features/raw-material-inspections/inspection-domain.ts`, `raw-material-inspections.tsx` | Inspection.id/number/date/location/lot/material/reference; finalized และ checks pending/pass/fail/na; inspectionStatus derives รอตรวจสอบ/ผ่าน/ไม่ผ่าน; มี inspector/approver ชื่อและวันที่; records เป็น local page state | ไม่มี Inventory item/warehouse IDs, affected qty หรือ allocation line; finalized/ผลผ่านไม่ใช่ stock authorization; ต้องแยก final QC disposition และ scope ของ Lot/ตำแหน่ง |
| QC การผลิต/ปุ๋ยอินทรีย์เคมี | navigation placeholder ไม่มี href/feature | ไม่ implemented | ห้ามอ้างการอนุมัติจริงหรือ reuse ผลตรวจคนละแบบโดยไม่ออกแบบ |
| Packing/ใบแจ้งแพ็ค | navigation placeholder ไม่มี href/feature | ไม่ implemented | conversion อาจใช้ WIP และ packaging แล้วได้ FG ต่างหน่วย ต้องกำหนด input/output/yield/scrap และ authoritative completion |
| Delivery | `SalesDocument`/`deliveryOrders` ใน `src/lib/mock-data/index.ts`; `src/features/delivery-orders/delivery-order-detail.tsx` | id/number/orderId/status; items อ่านผ่าน linked ProductionOrder ไม่มี delivery allocation line; UI confirm เปลี่ยน ฉบับร่าง → พร้อมส่ง; fixtures มี ส่งข้อมูลแล้ว/ยกเลิกแล้ว | “พร้อมส่ง” ไม่ใช่ physical dispatch และ “ส่งข้อมูลแล้ว” ไม่ใช่การจ่ายจริง; ไม่มี Lot/site/warehouse allocation หรือ signed dispatch evidence |
| ใบจ่ายสินค้า / Goods Issue | navigation placeholder ไม่มี href/feature | ไม่ implemented | ต้องเลือกว่า Goods Issue หรือ dispatch action ของ Delivery เป็น posting owner เดียว ไม่ให้ทั้งคู่ลง stock |
| Invoice | `SalesDocument`/`invoices` ใน `src/lib/mock-data/index.ts`; `src/features/invoices/invoice-detail.tsx` | id/number/orderId; ฉบับร่าง/ออกเอกสารแล้ว/ยกเลิกแล้ว; จำนวน/ราคามาจาก order และคำนวณ discount/VAT | เอกสารการเงินไม่มี stock identity; print/export/cancel เป็น demo ไม่ควรสร้างหรือล้าง stock movement |
| Products/Pricing | `Product` ใน `src/lib/mock-data/index.ts`; `src/features/products/products.tsx` | Product.id/sku/type/unit/status/price; source Sales product catalog แยกจาก BOM และ Inventory | ห้ามเทียบ Sales SKU, BOM Master.id และ InventoryItem.id โดยอัตโนมัติ; ไม่เปลี่ยน SKU/ราคา Sales Hub |
| Sites/Warehouses และ internal masters | `src/features/master-data/master-domain.ts`, `master-provider.tsx`, `internal-references.ts`, `src/lib/mock-data/master-settings.ts` | MasterRow.id/kind/code/name/active/parentId; masterRefs เก็บ snapshots สำหรับ PR/BOM/QC/Mixing | Settings เป็นเจ้าของ identities; Inventory fixtures reuse site-demo / wh-1 / wh-2 ส่วน east site เป็น isolated demo mapping; locationLabel ยังไม่ใช่ shared Location ID |
| Inventory Steps 1–3 | `src/features/inventory/inventory-domain.ts`, `inventory-ledger-domain.ts`, `inventory-operations-domain.ts`, `inventory-operations-provider.tsx` | 16 items, 21 baseline positions, 12 events; Manual RECEIVE/ISSUE/TRANSFER/ADJUST; one stable Factory Layout provider; BigInt6 | Ledger เป็นเจ้าของยอดเพียงแห่งเดียว; source integration metadata ยังไม่ถูกเพิ่มให้ event model ใน Step 4; QC STATUS_CHANGE มีใน historical ledger แต่ไม่ใช่ manual Step 3 command |

## Proposed posting policy / milestone / owner

| Source / action | ผลที่เสนอ | Posting owner ที่เสนอ | เงื่อนไข / ความเสี่ยง |
|---|---|---|---|
| PR / PO created, approved หรือออก PO | NONE | ไม่มี | การขอ/สั่งซื้อไม่ยืนยันว่ารับของแล้ว |
| Confirmed physical inbound | RECEIPT | Goods Receipt เป็นแหล่งหลักฐาน; Inventory ลง event | **DECISION_PENDING**: receiving ยังไม่มี workflow; QC_HOLD เฉพาะรายการที่ต้องตรวจตาม policy ไม่บังคับทุก receipt; preview เลือก QC_HOLD อย่างชัดเจน |
| Raw QC document created/saved | NONE | ไม่มี | เอกสารตรวจไม่เพิ่มปริมาณ |
| Final QC disposition | QC_HOLD → AVAILABLE หรือ BLOCKED | QC เป็นเจ้าของผลตัดสิน; Inventory เป็นเจ้าของสถานะ stock | **DECISION_PENDING**: qty, exact stock position, authorized actor และ stable allocation identity; รักษายอดรวม ไม่มี auto-release |
| BOM selected/edited | NONE | ไม่มี | planned requirements ไม่ใช่ actual consumption |
| Physical material issue confirmed | ISSUE | แนะนำ Material Issue เป็นเจ้าของหลักฐานเพียงหนึ่งราย | **DECISION_PENDING**: ต้องมีโมดูลและ milestone; กันตัดซ้ำกับ Mixing โดย shared physicalMovementId |
| Mixing saved / rounds passed | NONE | ไม่มี | เก็บหลักฐานผสมและ production Lot traceability; อ้าง Material Issue ในอนาคต แต่ไม่สร้าง issue ซ้ำ |
| Production Order created/status update | NONE | ไม่มี | ไม่เชื่อม source Sales Hub หรือ deduct planned BOM |
| Production output receipt confirmed | RECEIPT ของ WIP/FG | แนะนำ Production Receipt เพียงหนึ่งราย | **DECISION_PENDING**: output item, exact base qty/unit, Lot, destination key, source production/line และหลักฐานรับ; ห้ามรับซ้ำจากรายงานผลิต/Packing |
| Packing completion | MANUFACTURING_CONVERSION | specialized conversion contract | **DECISION_PENDING**: ไม่ใช่ transfer และห้ามบวก/เทียบยอดต่าง item/ต่างหน่วย; ยังไม่รองรับการ execute |
| Delivery draft/created/edited/printed/ready | NONE | ไม่มี | ไม่ยก “พร้อมส่ง” หรือ “ส่งข้อมูลแล้ว” ให้เป็น stock posting trigger |
| Physical dispatch confirmed | ISSUE ของ FG | เลือก Goods Issue **หรือ** confirmed dispatch ไม่ใช่ทั้งคู่ | **DECISION_PENDING**: final owner, immutable allocations, confirmation evidence; preview เป็น hypothetical contract เท่านั้น |
| Invoice create/issue/cancel | NONE | ไม่มี | การเงินไม่ลงสต็อกและไม่ reverse movement โดยอัตโนมัติ |
| Manual stock operations | Step 3 เดิม | Inventory manual commands | ปัจจุบันมีเพียง mock manual posting; ก่อนเชื่อมจริงต้องอ้าง shared movement evidence เพื่อไม่ลงซ้ำกับ source documents |

## Mapping / ownership ที่ต้องตกลงก่อนเชื่อมจริง

- Item Master เป็นเจ้าของ identity/unit/category; Inventory อ้าง stable IDs ไม่ใช่ชื่อหรือ SKU ที่เดาเอา BOM และ Sales Product ต้องมี explicit approved mapping และ policy สำหรับ units ที่สะกดต่าง (`kg` / `กิโลกรัม`) โดยไม่แปลงหน่วยเอง
- Warehouse/Site มาจาก Settings; ไม่สร้าง editable warehouse master เพิ่ม ต้องอนุมัติ ownership ของ locations และ migrate text locationLabel อย่างไม่ทำ historical identities เสีย
- QC เป็นเจ้าของ inspection decisions ไม่ใช่ quantity; Production เป็นเจ้าของ output evidence; Logistics เป็นเจ้าของ dispatch evidence; Inventory เป็นเจ้าของ event, posting identity, projected quantity, Lot positions และ idempotency
- ยังไม่มี final source milestones ให้เชื่อมจาก receiving/issue/output/dispatch ใน target: ทุก scenario ยืนยันจึงระบุ **สมมติ** ไม่เพิ่ม lifecycle/status ให้โมดูลที่ตรวจ
- ไม่จำเป็นต้องยก lifecycle จาก iCON/iTech/iFoam มาบังคับระบบใหม่: การเลือก authoritative document ใน target ยังต้องอนุมัติ ไม่แก้ reference repositories

## Scope evidence

Audit นี้อ่าน local models/providers/forms/navigation และ fixtures ข้างต้น ไม่มี API/DB/SQL หรือ live production data; ไม่แก้ business modules, global navigation, source statuses หรือ Steps 1–3 posting rules
