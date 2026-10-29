import "server-only";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { readDatabaseConfig } from "./database/config.ts";
import {
  actionRules,
  nextPRNumber,
  prChanges,
  statusLabel,
  validatePR,
  type PR,
  type PRAction,
  type PREvent,
  type PRItem,
  type PRStatus,
} from "../features/purchase-requisitions/pr-domain.ts";
import {
  allowedActions,
  savePo,
  transitionPo,
  type PoAction,
  type PoItem,
  type PurchaseOrder,
} from "../features/purchase-orders/po-domain.ts";

const PR_STATUSES = new Set<PRStatus>([
  "draft", "pending_approval", "approved", "rejected", "cancelled",
  "partial_po_created", "fully_po_created", "closed",
]);
const PO_STATUSES = new Set([
  "draft", "pending_approval", "approved", "partial_received", "received",
  "rejected", "cancelled", "closed",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_-]{1,100}$/;

export class PurchasingError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 503;
  constructor(
    status: 400 | 403 | 404 | 409 | 503,
    message: string,
  ) {
    super(message);
    this.status = status;
  }
}

export type PurchasingActor = Readonly<{
  id: string;
  displayName: string;
  verified: boolean;
  permissions: readonly ("purchasing.write" | "purchasing.approve")[];
}>;
export type PurchasingAllocation = Readonly<{
  id: string;
  prId: string;
  prItemId: string;
  poId: string;
  poItemId: string;
  quantity: number;
  released: boolean;
  at: string;
  actor: string;
}>;
export type PurchasingPOHistoryEvent = Readonly<{
  action: string;
  actor: string;
  at: string;
  note: string;
  from: string | null;
  to: string;
}>;
export type PurchasingSnapshot = Readonly<{
  prs: PR[];
  pos: PurchaseOrder[];
  prVersions: Record<string, string>;
  poVersions: Record<string, string>;
  allocations: PurchasingAllocation[];
  poHistory: Record<string, readonly PurchasingPOHistoryEvent[]>;
}>;

function actorAllowed(actor: PurchasingActor, approval = false): void {
  if (
    !actor?.verified ||
    !actor.id?.trim() ||
    !actor.displayName?.trim() ||
    !actor.permissions.includes(approval ? "purchasing.approve" : "purchasing.write")
  )
    throw new PurchasingError(403, "ไม่อนุญาตให้ดำเนินการจัดซื้อ");
}
function finite(value: unknown, scale = 4): value is number {
  const multiplier = 10 ** scale;
  return typeof value === "number" && Number.isFinite(value) && Math.round(value * multiplier) === value * multiplier;
}
function strings(value: Record<string, unknown>, keys: readonly string[]) {
  return keys.every((key) => typeof value[key] === "string" && (value[key] as string).length <= 2000);
}
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parsePurchasingPR(input: unknown): PR {
  if (!object(input) || !Array.isArray(input.items) || input.items.length > 100)
    throw new PurchasingError(400, "ข้อมูล PR ไม่ถูกต้อง");
  const header = ["id","number","date","requester","department","warehouseCode","warehouseName","category","transactionType","referenceNo","priority","neededDate","purpose","remarks","approver"];
  if (!strings(input, header) || !PR_STATUSES.has(input.status as PRStatus) || !Number.isSafeInteger(input.revision))
    throw new PurchasingError(400, "ข้อมูล PR ไม่ถูกต้อง");
  const items = input.items.map((value) => {
    if (!object(value) || !strings(value, ["id","code","name","supplierCode","supplierName","specification","unit","remarks"]) ||
      !ID.test(value.id as string) || !finite(value.quantity) || (value.price !== null && !finite(value.price, 2)))
      throw new PurchasingError(400, "รายการ PR ไม่ถูกต้อง");
    return { ...value, orderedQuantity: 0 } as PRItem;
  });
  const pr = { ...input, items, history: [], purchaseOrders: [] } as unknown as PR;
  const issue = validatePR(pr, false);
  if (issue) throw new PurchasingError(400, issue);
  return structuredClone(pr);
}

export function parsePurchasingPO(input: unknown): PurchaseOrder {
  if (!object(input) || !Array.isArray(input.items) || input.items.length > 100)
    throw new PurchasingError(400, "ข้อมูล PO ไม่ถูกต้อง");
  const header = ["id","po_no","po_date","supplier_id","supplier_code_snapshot","supplier_name_snapshot","warehouse_code","warehouse_name","currency_code","vat_type","payment_term","credit_days","expected_delivery_date","request_ref_id","request_ref_no","remarks","created_at","updated_at"];
  if (!strings(input, header) || !PO_STATUSES.has(input.status as string))
    throw new PurchasingError(400, "ข้อมูล PO ไม่ถูกต้อง");
  const items = input.items.map((value) => {
    if (!object(value) || !strings(value, ["id","raw_material_id","material_code_snapshot","material_name_snapshot","specification","ordered_qty","received_qty","unit","unit_price","discount_amount","tax_amount","expected_delivery_date","remarks"]) ||
      !ID.test(value.id as string) || (value.request_ref_item_id !== undefined && typeof value.request_ref_item_id !== "string"))
      throw new PurchasingError(400, "รายการ PO ไม่ถูกต้อง");
    return { ...value, request_ref_item_id: value.request_ref_item_id ?? "" } as PoItem;
  });
  return structuredClone({ ...input, items } as unknown as PurchaseOrder);
}

function prEvent(pr: PR, action: string, actor: PurchasingActor, note: string, to: PRStatus, changes: PREvent["changes"]): PREvent {
  return {
    id: crypto.randomUUID(), action, actor: actor.displayName, at: new Date().toISOString(),
    note: note.trim(), from: pr.status, to, changes,
  };
}

export function derivePurchasingSnapshot(
  prs: readonly PR[],
  pos: readonly PurchaseOrder[],
  allocations: readonly PurchasingAllocation[],
): { prs: PR[]; pos: PurchaseOrder[] } {
  const active = allocations.filter((row) => !row.released);
  const nextPos = pos.map((po) => ({
    ...structuredClone(po),
    items: po.items.map((item) => ({
      ...item,
      request_ref_item_id:
        active.find((row) => row.poItemId === item.id)?.prItemId ?? "",
    })),
  }));
  const nextPrs = prs.map((source) => {
    const pr = structuredClone(source);
    pr.items = pr.items.map((item) => ({
      ...item,
      orderedQuantity: Math.round(active.filter((row) => row.prItemId === item.id)
        .reduce((sum, row) => sum + row.quantity, 0) * 10_000) / 10_000,
    }));
    const linked = nextPos.filter((po) => active.some((row) => row.poId === po.id && row.prId === pr.id));
    pr.purchaseOrders = linked.map((po) => ({
      id: po.id,
      number: po.po_no,
      at: po.created_at,
      actor: allocations.find((row) => row.poId === po.id)?.actor ?? "",
      lines: active.filter((row) => row.poId === po.id && row.prId === pr.id)
        .map((row) => ({ itemId: row.prItemId, quantity: row.quantity })),
    }));
    if (["approved","partial_po_created","fully_po_created"].includes(pr.status)) {
      const ordered = pr.items.reduce((sum, item) => sum + item.orderedQuantity, 0);
      pr.status = ordered === 0 ? "approved" : pr.items.every((item) => item.orderedQuantity === item.quantity)
        ? "fully_po_created" : "partial_po_created";
    }
    return pr;
  });
  return { prs: nextPrs, pos: nextPos };
}

export function preparePRCreate(
  snapshot: PurchasingSnapshot,
  input: unknown,
  actor: PurchasingActor,
  submit: boolean,
  now: Date,
): PR {
  actorAllowed(actor);
  const draft = parsePurchasingPR(input);
  const issue = validatePR(draft, submit);
  if (issue) throw new PurchasingError(400, issue);
  const pr: PR = {
    ...draft,
    id: `pr-${crypto.randomUUID()}`,
    number: nextPRNumber(snapshot.prs, draft.date),
    status: submit ? "pending_approval" : "draft",
    revision: submit ? 2 : 1,
    history: [], purchaseOrders: [],
    items: draft.items.map((item) => ({ ...item, orderedQuantity: 0 })),
  };
  const created = prEvent({ ...pr, status: "draft" }, "create", actor, "สร้างฉบับร่าง", "draft", [{ field: "เลขที่ PR", before: "—", after: pr.number }]);
  created.at = now.toISOString(); created.from = null;
  pr.history = [created];
  if (submit) {
    const submitted = prEvent({ ...pr, status: "draft" }, "submit", actor, "", "pending_approval", [{ field: "สถานะ", before: statusLabel.draft, after: statusLabel.pending_approval }]);
    submitted.at = now.toISOString();
    pr.history.push(submitted);
  }
  return pr;
}

export function preparePRUpdate(old: PR, input: unknown, actor: PurchasingActor, submit: boolean, now: Date): PR {
  actorAllowed(actor);
  const draft = parsePurchasingPR(input);
  if (!['draft','rejected'].includes(old.status) || draft.id !== old.id || draft.revision !== old.revision)
    throw new PurchasingError(409, "เอกสารเปลี่ยนแล้วหรือสถานะนี้แก้ไขไม่ได้");
  const issue = validatePR(draft, submit);
  if (issue) throw new PurchasingError(400, issue);
  const changes = prChanges(old, draft);
  const next: PR = { ...draft, id: old.id, number: old.number, status: submit ? "pending_approval" : old.status,
    revision: old.revision + 1 + (submit ? 1 : 0), history: [...old.history], purchaseOrders: old.purchaseOrders,
    items: draft.items.map((item) => ({ ...item, orderedQuantity: 0 })) };
  if (changes.length) { const event = prEvent(old,"edit",actor,"แก้ไขข้อมูล",old.status,changes); event.at=now.toISOString(); next.history.push(event); }
  if (submit) { const event=prEvent({ ...next,status:old.status },"submit",actor,"","pending_approval",[{field:"สถานะ",before:statusLabel[old.status],after:statusLabel.pending_approval}]); event.at=now.toISOString(); next.history.push(event); }
  return next;
}

export function preparePRTransition(old: PR, action: PRAction, actor: PurchasingActor, note: string, now: Date): PR {
  actorAllowed(actor, action === "approve" || action === "reject");
  const rule = actionRules[action];
  if (!rule.from.includes(old.status)) throw new PurchasingError(409, "สถานะนี้ไม่อนุญาตให้ดำเนินการ");
  if ((action === "reject" || action === "cancel") && !note.trim()) throw new PurchasingError(400, "กรุณาระบุเหตุผล");
  if (action === "submit") { const issue=validatePR(old,true); if(issue) throw new PurchasingError(400,issue); }
  const event=prEvent(old,action,actor,note,rule.to,[{field:"สถานะ",before:statusLabel[old.status],after:statusLabel[rule.to]}]);
  event.at=now.toISOString();
  return { ...structuredClone(old), status:rule.to,revision:old.revision+1,history:[...old.history,event] };
}

export function preparePRCopy(snapshot: PurchasingSnapshot, source: PR, actor: PurchasingActor, now: Date): PR {
  const masterRefs = Object.fromEntries(
    Object.entries(source.masterRefs ?? {}).filter(([key]) => !key.startsWith("unit:") && !key.startsWith("supplier:")),
  );
  const items = source.items.map((item) => {
    const id = crypto.randomUUID();
    const unit = source.masterRefs?.[`unit:${item.id}`];
    const supplier = source.masterRefs?.[`supplier:${item.id}`];
    if (unit) masterRefs[`unit:${id}`] = unit;
    if (supplier) masterRefs[`supplier:${id}`] = supplier;
    return { ...item, id, orderedQuantity: 0 };
  });
  return preparePRCreate(snapshot, {
    ...structuredClone(source),
    id: "",
    number: "",
    status: "draft",
    revision: 0,
    history: [],
    purchaseOrders: [],
    referenceNo: source.number,
    masterRefs,
    items,
  }, actor, false, now);
}

function poQuantity(value: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || Math.round(number * 10_000) !== number * 10_000)
    throw new PurchasingError(400, "จำนวน PO ไม่ถูกต้อง");
  return number;
}

export function validatePOAllocations(snapshot: PurchasingSnapshot, doc: PurchaseOrder, editingPoId = ""): void {
  const linkedItems = doc.items.filter((item) => item.request_ref_item_id);
  if (!doc.request_ref_id) {
    if (linkedItems.length) throw new PurchasingError(400, "PO ตรงต้องไม่มี PR item reference");
    return;
  }
  const pr = snapshot.prs.find((row) => row.id === doc.request_ref_id);
  if (!pr || !["approved","partial_po_created","fully_po_created"].includes(pr.status) || pr.number !== doc.request_ref_no)
    throw new PurchasingError(409, "PR อ้างอิงไม่พร้อมสำหรับออก PO");
  if (linkedItems.length !== doc.items.length) throw new PurchasingError(400, "PO ที่อ้างอิง PR ต้องระบุ PR item ทุกรายการ");
  const active = snapshot.allocations.filter((row) => !row.released && row.poId !== editingPoId);
  const planned = new Map<string, number>();
  for (const item of doc.items) {
    const source = pr.items.find((row) => row.id === item.request_ref_item_id);
    if (!source || source.code !== item.material_code_snapshot || source.name !== item.material_name_snapshot || source.unit !== item.unit)
      throw new PurchasingError(400, "PR item reference หรือ snapshot ไม่ตรงกัน");
    planned.set(source.id, (planned.get(source.id) ?? 0) + poQuantity(item.ordered_qty));
  }
  for (const [itemId, quantity] of planned) {
    const source = pr.items.find((row) => row.id === itemId)!;
    const used = active.filter((row) => row.prItemId === itemId).reduce((sum,row)=>sum+row.quantity,0);
    if (Math.round((used + quantity) * 10_000) > Math.round(source.quantity * 10_000))
      throw new PurchasingError(409, "จำนวน PO เกินยอดคงเหลือของ PR");
  }
}

export function preparePOSave(snapshot: PurchasingSnapshot, input: unknown, actor: PurchasingActor, submit: boolean, now: Date, id: string): PurchaseOrder {
  actorAllowed(actor);
  const doc=parsePurchasingPO(input);
  validatePOAllocations(snapshot,doc,doc.id);
  const result=savePo(snapshot.pos,doc,id,now.toISOString(),submit);
  if (!result.saved) throw new PurchasingError(doc.id ? 409 : 400,Object.values(result.errors)[0] ?? "ข้อมูล PO ไม่ถูกต้อง");
  return result.saved;
}

export function preparePOTransition(snapshot: PurchasingSnapshot, id: string, action: PoAction, actor: PurchasingActor, now: Date): PurchaseOrder {
  actorAllowed(actor,action === "approve" || action === "reject" || action === "return_draft");
  const old=snapshot.pos.find((row)=>row.id===id);
  if(!old || action === "delete" || !allowedActions(old.status).includes(action)) throw new PurchasingError(409,"สถานะ PO ไม่รองรับการกระทำนี้");
  return transitionPo(snapshot.pos,[id],action,now.toISOString()).find((row)=>row.id===id)!;
}

type PurchasingPool = Pick<Pool,"connect"|"on"|"end">;
export function createPurchasingStore(env=process.env,makePool:(options:PoolConfig)=>PurchasingPool=(options)=>new Pool(options)) {
  if(env.NODE_ENV!=="development" || env.FACTORY_PURCHASING_ENABLED!=="true" || env.FACTORY_PURCHASING_DB_USER!=="factory_purchasing_writer" || !env.FACTORY_PURCHASING_DB_PASSWORD)
    throw new PurchasingError(503,"ต้องเปิด Purchasing PostgreSQL ด้วย dedicated writer role");
  const c=readDatabaseConfig({...env,FACTORY_DB_USER:env.FACTORY_PURCHASING_DB_USER,FACTORY_DB_PASSWORD:env.FACTORY_PURCHASING_DB_PASSWORD});
  if(c.host!=="localhost") throw new PurchasingError(503,"Purchasing อนุญาตเฉพาะ localhost");
  const pool=makePool({host:c.host,port:c.port,database:c.database,user:c.user,password:c.password,ssl:false,max:c.max,
    connectionTimeoutMillis:c.connectionTimeoutMillis,idleTimeoutMillis:c.idleTimeoutMillis,statement_timeout:c.statementTimeoutMillis,
    query_timeout:c.statementTimeoutMillis+1000,lock_timeout:c.statementTimeoutMillis,options:"-c search_path=pg_catalog",application_name:"ionflow-factory-purchasing"});
  pool.on("error",()=>console.error("PURCHASING_IDLE_CONNECTION_FAILED"));
  async function transaction<T>(write:boolean,work:(client:PoolClient)=>Promise<T>):Promise<T>{
    const client=await pool.connect().catch(()=>{throw new PurchasingError(503,"เชื่อมต่อ Purchasing PostgreSQL ไม่สำเร็จ");}); let broken=false;
    try{await client.query(write?"BEGIN ISOLATION LEVEL SERIALIZABLE":"BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const identity=await client.query(`SELECT current_database()=$1 AND current_user=$2 AND inet_server_port()=5432
        AND inet_server_addr() IN ('127.0.0.1'::inet,'::1'::inet) AND NOT r.rolsuper AND NOT r.rolcreatedb
        AND NOT r.rolcreaterole AND NOT r.rolinherit AND NOT r.rolreplication AND NOT r.rolbypassrls
        AND NOT has_schema_privilege(current_user,$3,'CREATE') AND NOT has_database_privilege(current_user,current_database(),'CREATE')
        AND NOT EXISTS(SELECT 1 FROM pg_roles p WHERE p.oid<>r.oid AND pg_has_role(r.oid,p.oid,'MEMBER'))
        AND to_regclass('inventory_sandbox.purchasing_prs') IS NOT NULL AND to_regclass('inventory_sandbox.purchasing_pos') IS NOT NULL AS safe
        FROM pg_roles r WHERE rolname=current_user`,[c.database,c.user,c.schema]);
      if(identity.rows[0]?.safe!==true) throw new PurchasingError(503,"Purchasing runtime role ไม่ปลอดภัย");
      if(write) await client.query("SELECT pg_advisory_xact_lock(20261021,8)");
      const result=await work(client); await client.query("COMMIT"); return result;
    }catch(error){try{await client.query("ROLLBACK");}catch{broken=true;} if(error instanceof PurchasingError)throw error;
      const code=error&&typeof error==="object"&&"code" in error?error.code:"";
      throw new PurchasingError(code==="23505"||code==="40001"?409:503,code==="23505"?"เลขเอกสารหรือคำสั่งซ้ำ":code==="40001"?"ข้อมูลเปลี่ยนพร้อมกัน กรุณาลองใหม่":"Purchasing PostgreSQL ไม่พร้อมใช้งาน");
    }finally{client.release(broken);}}

  async function load(client:PoolClient):Promise<PurchasingSnapshot>{
    const [prHeaders,prItems,prHistory,poHeaders,poItems,poHistoryRows,allocationRows]=await Promise.all([
      client.query("SELECT id,document_number,document_date,status,header_payload,version::text AS version,created_at,updated_at FROM inventory_sandbox.purchasing_prs WHERE archived_at IS NULL ORDER BY updated_at DESC,id"),
      client.query("SELECT * FROM inventory_sandbox.purchasing_pr_items ORDER BY pr_id,line_no"),
      client.query("SELECT * FROM inventory_sandbox.purchasing_pr_history ORDER BY pr_id,record_version,id"),
      client.query("SELECT id,document_number,document_date,status,header_payload,version::text AS version,created_at,updated_at FROM inventory_sandbox.purchasing_pos WHERE archived_at IS NULL ORDER BY updated_at DESC,id"),
      client.query("SELECT * FROM inventory_sandbox.purchasing_po_items WHERE archived_at IS NULL ORDER BY po_id,line_no"),
      client.query("SELECT * FROM inventory_sandbox.purchasing_po_history ORDER BY po_id,record_version,id"),
      client.query(`SELECT a.id::text,a.pr_id,a.pr_item_id,a.po_id,a.po_item_id,a.allocated_quantity::text,a.released_at,
        a.allocated_at,h.actor_display_name FROM inventory_sandbox.purchasing_pr_po_allocations a
        JOIN inventory_sandbox.purchasing_po_history h ON h.id=a.allocated_by_event_id ORDER BY a.allocated_at,a.id`),
    ]);
    const prs=prHeaders.rows.map((row)=>({ ...row.header_payload,id:row.id,number:row.document_number,date:row.document_date.toISOString().slice(0,10),status:row.status,
      revision:Number(row.version),items:prItems.rows.filter((item)=>item.pr_id===row.id).map((item)=>({id:item.id,code:item.material_code_snapshot,name:item.material_name_snapshot,
        supplierCode:item.supplier_code_snapshot,supplierName:item.supplier_name_snapshot,specification:item.specification,quantity:Number(item.requested_quantity),unit:item.unit_snapshot,
        price:item.estimated_unit_price===null?null:Number(item.estimated_unit_price),remarks:item.remarks,orderedQuantity:0})),
      history:prHistory.rows.filter((event)=>event.pr_id===row.id).map((event)=>({id:event.id,action:event.action,actor:event.actor_display_name,at:event.occurred_at.toISOString(),note:event.note,
        from:event.from_status,to:event.to_status,changes:event.changes})),purchaseOrders:[] })) as PR[];
    const pos=poHeaders.rows.map((row)=>({ ...row.header_payload,id:row.id,po_no:row.document_number,po_date:row.document_date.toISOString().slice(0,10),status:row.status,
      created_at:row.created_at.toISOString(),updated_at:row.updated_at.toISOString(),items:poItems.rows.filter((item)=>item.po_id===row.id).map((item)=>({id:item.id,raw_material_id:item.raw_material_id??"",
        material_code_snapshot:item.material_code_snapshot,material_name_snapshot:item.material_name_snapshot,specification:item.specification,ordered_qty:String(item.ordered_quantity),received_qty:String(item.received_quantity),
        unit:item.unit_snapshot,unit_price:String(item.unit_price),discount_amount:String(item.discount_amount),tax_amount:String(item.tax_amount),expected_delivery_date:item.expected_delivery_date?.toISOString().slice(0,10)??"",remarks:item.remarks})) })) as PurchaseOrder[];
    const allocations=allocationRows.rows.map((row)=>({id:row.id,prId:row.pr_id,prItemId:row.pr_item_id,poId:row.po_id,poItemId:row.po_item_id,quantity:Number(row.allocated_quantity),released:row.released_at!==null,at:row.allocated_at.toISOString(),actor:row.actor_display_name}));
    const poHistory:Record<string,PurchasingPOHistoryEvent[]>={};
    for(const event of poHistoryRows.rows)(poHistory[event.po_id]??=[]).push({action:event.action,actor:event.actor_display_name,at:event.occurred_at.toISOString(),note:event.note,from:event.from_status,to:event.to_status});
    const derived=derivePurchasingSnapshot(prs,pos,allocations);
    return { ...derived,prVersions:Object.fromEntries(prHeaders.rows.map((row)=>[row.id,row.version])),poVersions:Object.fromEntries(poHeaders.rows.map((row)=>[row.id,row.version])),allocations,poHistory };
  }

  async function duplicateRequest(client:PoolClient,table:string,requestId:string){
    const result=await client.query(`SELECT 1 FROM inventory_sandbox.${table} WHERE request_id=$1`,[requestId]); return result.rowCount!==0;
  }
  function requestId(value:string){if(!UUID.test(value))throw new PurchasingError(400,"Request ID ไม่ถูกต้อง");return value;}
  async function verifyMasterRefs(client:PoolClient,refs:{id:string;kind:string;code?:string;name?:string}[]){
    const unique=[...new Map(refs.filter((ref)=>ref.id).map((ref)=>[ref.id,ref])).values()]; if(!unique.length)return;
    const rows=await client.query("SELECT id,kind,code,name FROM inventory_sandbox.settings_masters WHERE id=ANY($1::text[]) AND (payload->>'active')::boolean=true",[unique.map((ref)=>ref.id)]);
    if(unique.some((ref)=>!rows.rows.some((row)=>row.id===ref.id&&row.kind===ref.kind&&(!ref.code||row.code===ref.code)&&(!ref.name||row.name===ref.name))))
      throw new PurchasingError(409,"ข้อมูลหลักไม่ตรงชนิด snapshot หรือไม่ได้เปิดใช้งาน");
  }
  async function activeWarehouseSite(client:PoolClient,id:string,code:string,name:string){
    const rows=await client.query(`SELECT warehouse.id FROM inventory_sandbox.settings_masters warehouse
      JOIN inventory_sandbox.settings_masters site ON site.id=warehouse.parent_id AND site.kind='sites' AND (site.payload->>'active')::boolean=true
      WHERE warehouse.id=$1 AND warehouse.kind='warehouses' AND warehouse.code=$2 AND warehouse.name=$3 AND (warehouse.payload->>'active')::boolean=true`,[id,code,name]);
    if(rows.rows.length!==1)throw new PurchasingError(409,"Warehouse ต้องตรงกับ Settings และอยู่ใต้ Active Site");
  }

  async function persistPR(client:PoolClient,pr:PR,expectedVersion:string|null,actor:PurchasingActor,request:string){
    const found=await client.query("SELECT version::text AS version FROM inventory_sandbox.purchasing_prs WHERE id=$1 FOR UPDATE",[pr.id]);
    if((found.rows[0]?.version??null)!==expectedVersion)throw new PurchasingError(409,"PR version เปลี่ยนแล้ว");
    const warehouseId=pr.masterRefs?.warehouse?.id??null;
    const unitIds=pr.items.map((item)=>pr.masterRefs?.[`unit:${item.id}`]?.id??"");
    const supplierIds=pr.items.map((item)=>pr.masterRefs?.[`supplier:${item.id}`]?.id??"");
    if(pr.status!=="draft"&&(!warehouseId||unitIds.some((id)=>!id)||pr.items.some((item,index)=>!!(item.supplierCode||item.supplierName)&&!supplierIds[index])) )
      throw new PurchasingError(409,"PR ยังไม่มี authoritative Settings references ครบถ้วน");
    if(warehouseId)await activeWarehouseSite(client,warehouseId,pr.warehouseCode,pr.warehouseName);
    await verifyMasterRefs(client,[
      ...pr.items.flatMap((item)=>{
        const supplier=pr.masterRefs?.[`supplier:${item.id}`]; const unit=pr.masterRefs?.[`unit:${item.id}`];
        return [
          ...(supplier?[{id:supplier.id,kind:"suppliers",code:supplier.code,name:supplier.name}]:[]),
          ...(unit?[{id:unit.id,kind:"units"}]:[]),
        ];
      }),
    ]);
    const payload={...pr,items:undefined,history:undefined,purchaseOrders:undefined,id:undefined,number:undefined,date:undefined,status:undefined,revision:undefined};
    const saved=await client.query(`INSERT INTO inventory_sandbox.purchasing_prs(id,document_number,document_date,status,warehouse_id,header_payload)
      VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(id) DO UPDATE SET document_date=EXCLUDED.document_date,status=EXCLUDED.status,warehouse_id=EXCLUDED.warehouse_id,
      header_payload=EXCLUDED.header_payload,version=purchasing_prs.version+1,updated_at=clock_timestamp() RETURNING version::text AS version`,[pr.id,pr.number,pr.date,pr.status,warehouseId,JSON.stringify(payload)]);
    await client.query("DELETE FROM inventory_sandbox.purchasing_pr_items WHERE pr_id=$1",[pr.id]);
    for(const [index,item] of pr.items.entries())await client.query(`INSERT INTO inventory_sandbox.purchasing_pr_items(id,pr_id,line_no,material_code_snapshot,material_name_snapshot,supplier_id,supplier_code_snapshot,supplier_name_snapshot,specification,requested_quantity,unit_id,unit_snapshot,estimated_unit_price,remarks)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,[item.id,pr.id,index+1,item.code,item.name,pr.masterRefs?.[`supplier:${item.id}`]?.id??null,item.supplierCode,item.supplierName,item.specification,item.quantity,pr.masterRefs?.[`unit:${item.id}`]?.id??null,item.unit,item.price,item.remarks]);
    const retained=await client.query("SELECT id::text FROM inventory_sandbox.purchasing_pr_history WHERE pr_id=$1",[pr.id]);
    const retainedIds=new Set(retained.rows.map((row)=>row.id));
    const events=pr.history.filter((event)=>!retainedIds.has(event.id));
    for(const [index,event] of events.entries())await client.query(`INSERT INTO inventory_sandbox.purchasing_pr_history(id,pr_id,record_version,action,actor_id,actor_display_name,occurred_at,note,from_status,to_status,changes,request_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)`,[event.id,pr.id,saved.rows[0].version,event.action,actor.id,actor.displayName,event.at,event.note,event.from,event.to,JSON.stringify(event.changes),index===events.length-1?request:null]);
  }

  async function persistPO(client:PoolClient,po:PurchaseOrder,expectedVersion:string|null,actor:PurchasingActor,action:string,request:string,snapshot:PurchasingSnapshot,replaceAllocations=false){
    const found=await client.query("SELECT version::text AS version FROM inventory_sandbox.purchasing_pos WHERE id=$1 FOR UPDATE",[po.id]);
    if((found.rows[0]?.version??null)!==expectedVersion)throw new PurchasingError(409,"PO version เปลี่ยนแล้ว");
    const eventId=crypto.randomUUID(); const supplier=po.supplier_id;
    if(!supplier)throw new PurchasingError(409,"PO ต้องอ้างอิง Supplier จาก Settings");
    const warehouse=await client.query(`SELECT warehouse.id FROM inventory_sandbox.settings_masters warehouse
      JOIN inventory_sandbox.settings_masters site ON site.id=warehouse.parent_id AND site.kind='sites' AND (site.payload->>'active')::boolean=true
      WHERE warehouse.kind='warehouses' AND lower(warehouse.code)=lower($1) AND lower(warehouse.name)=lower($2)
        AND (warehouse.payload->>'active')::boolean=true`,[po.warehouse_code,po.warehouse_name]);
    if(warehouse.rows.length!==1)throw new PurchasingError(409,"ไม่พบ Warehouse ภายใต้ Active Site ที่ตรงกับ PO");
    await verifyMasterRefs(client,[{id:supplier,kind:"suppliers",code:po.supplier_code_snapshot,name:po.supplier_name_snapshot}]);
    const payload={...po,items:undefined,id:undefined,po_no:undefined,po_date:undefined,status:undefined,created_at:undefined,updated_at:undefined};
    const saved=await client.query(`INSERT INTO inventory_sandbox.purchasing_pos(id,document_number,document_date,status,supplier_id,warehouse_id,source_pr_id,header_payload)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT(id) DO UPDATE SET document_number=EXCLUDED.document_number,document_date=EXCLUDED.document_date,status=EXCLUDED.status,supplier_id=EXCLUDED.supplier_id,warehouse_id=EXCLUDED.warehouse_id,
      source_pr_id=EXCLUDED.source_pr_id,header_payload=EXCLUDED.header_payload,version=purchasing_pos.version+1,updated_at=clock_timestamp() RETURNING version::text AS version`,[po.id,po.po_no,po.po_date,po.status,supplier||null,warehouse.rows[0].id,po.request_ref_id||null,JSON.stringify(payload)]);
    await client.query(`INSERT INTO inventory_sandbox.purchasing_po_history(id,po_id,record_version,action,actor_id,actor_display_name,occurred_at,note,from_status,to_status,request_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,'',$8,$9,$10)`,[eventId,po.id,saved.rows[0].version,action,actor.id,actor.displayName,new Date().toISOString(),snapshot.pos.find((row)=>row.id===po.id)?.status??null,po.status,request]);
    if(action==="cancel"||action==="reject"||replaceAllocations)await client.query("UPDATE inventory_sandbox.purchasing_pr_po_allocations SET released_at=clock_timestamp(),released_by_event_id=$2,release_reason=$3 WHERE po_id=$1 AND released_at IS NULL",[po.id,eventId,action==="cancel"?"PO_CANCELLED":action==="reject"?"PO_REJECTED":"PO_UPDATED"]);
    if(replaceAllocations)await client.query("UPDATE inventory_sandbox.purchasing_po_items SET archived_at=clock_timestamp() WHERE po_id=$1 AND archived_at IS NULL",[po.id]);
    if(replaceAllocations)for(const [index,item] of po.items.entries()){
      const unit=await client.query("SELECT id FROM inventory_sandbox.settings_masters WHERE kind='units' AND (lower(code)=lower($1) OR lower(name)=lower($1) OR payload->'aliases' ? $1) AND (payload->>'active')::boolean=true",[item.unit]);
      if(unit.rows.length!==1)throw new PurchasingError(409,"ไม่พบหน่วยนับที่เปิดใช้งานตรงกับ PO");
      await client.query(`INSERT INTO inventory_sandbox.purchasing_po_items(id,po_id,line_no,raw_material_id,material_code_snapshot,material_name_snapshot,specification,ordered_quantity,received_quantity,unit_id,unit_snapshot,unit_price,discount_amount,tax_amount,expected_delivery_date,remarks,archived_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NULL) ON CONFLICT(id) DO UPDATE SET line_no=EXCLUDED.line_no,material_code_snapshot=EXCLUDED.material_code_snapshot,material_name_snapshot=EXCLUDED.material_name_snapshot,specification=EXCLUDED.specification,ordered_quantity=EXCLUDED.ordered_quantity,received_quantity=EXCLUDED.received_quantity,unit_id=EXCLUDED.unit_id,unit_snapshot=EXCLUDED.unit_snapshot,unit_price=EXCLUDED.unit_price,discount_amount=EXCLUDED.discount_amount,tax_amount=EXCLUDED.tax_amount,expected_delivery_date=EXCLUDED.expected_delivery_date,remarks=EXCLUDED.remarks,archived_at=NULL`,[item.id,po.id,index+1,item.raw_material_id||null,item.material_code_snapshot,item.material_name_snapshot,item.specification,item.ordered_qty,item.received_qty,unit.rows[0].id,item.unit,item.unit_price,item.discount_amount||0,item.tax_amount||0,item.expected_delivery_date||null,item.remarks]);
    }
    if(replaceAllocations&&po.request_ref_id)for(const item of po.items)await client.query(`INSERT INTO inventory_sandbox.purchasing_pr_po_allocations(id,pr_id,pr_item_id,po_id,po_item_id,allocated_quantity,allocated_by_event_id)
      VALUES($1,$2,$3,$4,$5,$6,$7)`,[crypto.randomUUID(),po.request_ref_id,item.request_ref_item_id,po.id,item.id,item.ordered_qty,eventId]);
  }

  return {
    read:()=>transaction(false,load),
    savePR:(input:unknown,expectedVersion:string|null,actor:PurchasingActor,submit:boolean,request:string)=>transaction(true,async(client)=>{
      request=requestId(request); if(await duplicateRequest(client,"purchasing_pr_history",request))return load(client);
      const snapshot=await load(client); const parsed=parsePurchasingPR(input); const old=parsed.id?snapshot.prs.find((row)=>row.id===parsed.id):undefined;
      if(parsed.id&&!old)throw new PurchasingError(404,"ไม่พบ PR เดิม");
      if(!parsed.id&&expectedVersion!==null)throw new PurchasingError(409,"PR ใหม่ต้องไม่มี expected version");
      const pr=old?preparePRUpdate(old,parsed,actor,submit,new Date()):preparePRCreate(snapshot,parsed,actor,submit,new Date());
      await persistPR(client,pr,old?expectedVersion:null,actor,request); return load(client);
    }),
    actPR:(id:string,expectedVersion:string,action:PRAction,note:string,actor:PurchasingActor,request:string)=>transaction(true,async(client)=>{
      request=requestId(request); if(await duplicateRequest(client,"purchasing_pr_history",request))return load(client);
      const snapshot=await load(client); const old=snapshot.prs.find((row)=>row.id===id); if(!old)throw new PurchasingError(404,"ไม่พบ PR");
      if(action==="cancel"&&snapshot.allocations.some((row)=>row.prId===id&&!row.released))throw new PurchasingError(409,"ยกเลิก PR ไม่ได้ขณะที่ยังมี PO ที่ใช้งานอยู่");
      const pr=preparePRTransition(old,action,actor,note,new Date()); await persistPR(client,pr,expectedVersion,actor,request); return load(client);
    }),
    copyPR:(id:string,actor:PurchasingActor,request:string)=>transaction(true,async(client)=>{
      request=requestId(request); if(await duplicateRequest(client,"purchasing_pr_history",request))return load(client);
      const snapshot=await load(client); const old=snapshot.prs.find((row)=>row.id===id); if(!old)throw new PurchasingError(404,"ไม่พบ PR");
      const pr=preparePRCopy(snapshot,old,actor,new Date()); await persistPR(client,pr,null,actor,request); return load(client);
    }),
    savePO:(input:unknown,expectedVersion:string|null,actor:PurchasingActor,submit:boolean,request:string)=>transaction(true,async(client)=>{
      request=requestId(request); if(await duplicateRequest(client,"purchasing_po_history",request))return load(client);
      const snapshot=await load(client); const parsed=parsePurchasingPO(input); const id=parsed.id||`po-${crypto.randomUUID()}`;
      const po=preparePOSave(snapshot,parsed,actor,submit,new Date(),id); await persistPO(client,po,parsed.id?expectedVersion:null,actor,submit?"submit":parsed.id?"edit":"create",request,snapshot,true); return load(client);
    }),
    actPO:(id:string,expectedVersion:string,action:PoAction,actor:PurchasingActor,request:string)=>transaction(true,async(client)=>{
      request=requestId(request); if(await duplicateRequest(client,"purchasing_po_history",request))return load(client);
      const snapshot=await load(client); const po=preparePOTransition(snapshot,id,action,actor,new Date());
      if(action==="submit")validatePOAllocations(snapshot,po,po.id);
      await persistPO(client,po,expectedVersion,actor,action,request,snapshot,action==="submit"); return load(client);
    }),
    close:()=>pool.end(),
  };
}
