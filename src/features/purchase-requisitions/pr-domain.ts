import type { MasterReferences } from "@/src/features/master-data/master-domain";
export type PRStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "cancelled"
  | "partial_po_created"
  | "fully_po_created"
  | "closed";
export type PRPriority = "low" | "normal" | "high" | "urgent";
export type PRItem = {
  id: string;
  code: string;
  name: string;
  supplierCode: string;
  supplierName: string;
  specification: string;
  quantity: number;
  unit: string;
  price: number | null;
  remarks: string;
  orderedQuantity: number;
};
export type PRChange = { field: string; before: string; after: string };
export type PREvent = {
  id: string;
  action: string;
  actor: string;
  at: string;
  note: string;
  from: PRStatus | null;
  to: PRStatus;
  changes: PRChange[];
};
export type DemoPO = {
  id: string;
  number: string;
  at: string;
  actor: string;
  lines: { itemId: string; quantity: number }[];
};
export type PR = {
  masterRefs?: MasterReferences;
  id: string;
  number: string;
  date: string;
  requester: string;
  department: string;
  warehouseCode: string;
  warehouseName: string;
  category: string;
  transactionType: "VAT" | "Non-VAT";
  referenceNo: string;
  priority: PRPriority;
  neededDate: string;
  purpose: string;
  remarks: string;
  approver: string;
  status: PRStatus;
  items: PRItem[];
  history: PREvent[];
  purchaseOrders: DemoPO[];
  revision: number;
};
export const statusLabel: Record<PRStatus, string> = {
  draft: "ฉบับร่าง",
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
  partial_po_created: "ออก PO บางส่วน",
  fully_po_created: "ออก PO ครบแล้ว",
  closed: "ปิดงาน",
};
export const statusTone: Record<
  PRStatus,
  "neutral" | "warning" | "success" | "destructive" | "info"
> = {
  draft: "neutral",
  pending_approval: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "destructive",
  partial_po_created: "info",
  fully_po_created: "info",
  closed: "neutral",
};
export const priorityLabel: Record<PRPriority, string> = {
  low: "ต่ำ",
  normal: "ปกติ",
  high: "สูง",
  urgent: "ด่วน",
};
export const actionLabel: Record<string, string> = {
  create: "สร้าง PR",
  edit: "แก้ไข PR",
  submit: "ส่งอนุมัติ",
  approve: "อนุมัติ",
  reject: "ไม่อนุมัติ",
  cancel: "ยกเลิก PR",
  close: "ปิดงาน",
  create_po: "สร้าง PO สาธิต",
  delete: "ลบฉบับร่าง",
  import: "นำเข้าข้อมูลตัวอย่าง",
};
// shortcut: fixed mock admin; replace with authenticated server permissions before using real data.
export const demoPRUser = {
  name: "ผู้ใช้งานสาธิต",
  department: "บริหาร",
  email: "admin@example.test",
};
export const prUsers = [
  {
    name: "พนักงานฝ่ายผลิต",
    department: "ฝ่ายผลิต",
    email: "production@example.com",
  },
  {
    name: "พนักงานคลัง",
    department: "คลังสินค้า",
    email: "warehouse@example.com",
  },
  {
    name: "หัวหน้าแผนก",
    department: "ฝ่ายผลิต",
    email: "supervisor@example.com",
  },
  { name: "ผู้จัดการ", department: "บริหาร", email: "manager@example.com" },
];
export const prWarehouses = [
  { code: "WH01", name: "คลังหลัก" },
  { code: "WH02", name: "คลังรอง" },
];
export const prSuppliers = [
  { code: "SUP-01", name: "ผู้ขายตัวอย่าง" },
  { code: "SUP-02", name: "ผู้ขายสาธิต 2" },
];
export const prMaterials = [
  {
    code: "RM-001",
    name: "วัตถุดิบตัวอย่าง",
    unit: "kg",
    price: 25,
    specification: "เกรด A",
    supplierCode: "SUP-01",
  },
  {
    code: "PK-001",
    name: "ถุงบรรจุ",
    unit: "ใบ",
    price: 4,
    specification: "บรรจุภัณฑ์สาธิต",
    supplierCode: "SUP-02",
  },
  {
    code: "RM-002",
    name: "วัสดุทดลองสำหรับงานซ่อมบำรุง",
    unit: "ชิ้น",
    price: 120.5,
    specification: "รุ่น DEMO",
    supplierCode: "SUP-01",
  },
];
export const newPRItem = (id: string): PRItem => ({
  id,
  code: "",
  name: "",
  supplierCode: "",
  supplierName: "",
  specification: "",
  quantity: 1,
  unit: "",
  price: null,
  remarks: "",
  orderedQuantity: 0,
});
export const newPR = (): PR => ({
  id: "",
  number: "",
  date: "2026-10-15",
  requester: "",
  department: "",
  warehouseCode: "",
  warehouseName: "",
  category: "",
  transactionType: "Non-VAT",
  referenceNo: "",
  priority: "normal",
  neededDate: "",
  purpose: "",
  remarks: "",
  approver: "",
  status: "draft",
  items: [newPRItem("item-1")],
  history: [],
  purchaseOrders: [],
  revision: 0,
});
export function materialItem(code: string, id: string): PRItem {
  const material = prMaterials.find((item) => item.code === code);
  if (!material) throw new Error("ไม่พบสินค้าในข้อมูลสาธิต");
  const supplier = prSuppliers.find(
    (item) => item.code === material.supplierCode,
  )!;
  return { ...newPRItem(id), ...material, supplierName: supplier.name };
}
const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
const qty = (value: number) => Math.round(value * 10000) / 10000;
export const remainingQuantity = (item: PRItem) =>
  qty(item.quantity - item.orderedQuantity);
export function lineAmounts(
  item: PRItem,
  transactionType: PR["transactionType"],
) {
  if (
    item.price === null ||
    !Number.isFinite(item.price) ||
    item.price < 0 ||
    !Number.isFinite(item.quantity) ||
    item.quantity <= 0
  )
    return null;
  const subtotal = cents(item.quantity * item.price);
  // Demo rule: exclusive VAT 7%, rounded to satang per line; not a tax engine.
  const tax = transactionType === "VAT" ? Math.round((subtotal * 7) / 100) : 0;
  if (![subtotal, tax, subtotal + tax].every(Number.isSafeInteger)) return null;
  return {
    subtotal: subtotal / 100,
    tax: tax / 100,
    total: (subtotal + tax) / 100,
  };
}
export function prAmounts(pr: PR) {
  const lines = pr.items.map((item) => lineAmounts(item, pr.transactionType));
  const missing = lines.filter((line) => line === null).length;
  const subtotal = lines.reduce(
    (sum, line) => sum + (line ? cents(line.subtotal) : 0),
    0,
  );
  const tax = lines.reduce(
    (sum, line) => sum + (line ? cents(line.tax) : 0),
    0,
  );
  return {
    subtotal: subtotal / 100,
    tax: tax / 100,
    total: (subtotal + tax) / 100,
    missing,
    complete:
      pr.items.length > 0 &&
      missing === 0 &&
      Number.isSafeInteger(subtotal + tax),
  };
}
export function estimatedAmount(pr: PR): number | null {
  const totals = prAmounts(pr);
  return totals.complete ? totals.total : null;
}
export function quantitySummary(pr: PR): string {
  const units = new Map<string, number>();
  pr.items.forEach((item) =>
    units.set(
      item.unit || "ไม่ระบุหน่วย",
      qty((units.get(item.unit || "ไม่ระบุหน่วย") || 0) + item.quantity),
    ),
  );
  return Array.from(
    units,
    ([unit, total]) => `${total.toLocaleString("th-TH")} ${unit}`,
  ).join(" · ");
}
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validatePR(pr: PR, submit = true): string | null {
  if (!validDate(pr.date) || (pr.neededDate && !validDate(pr.neededDate)))
    return "กรุณาระบุวันที่ให้ถูกต้อง";
  if (pr.neededDate && pr.neededDate < pr.date)
    return "วันที่ต้องการใช้ต้องไม่ก่อนวันที่เอกสาร";
  if (
    !(pr.transactionType === "VAT" || pr.transactionType === "Non-VAT") ||
    !(pr.priority in priorityLabel)
  )
    return "ประเภทหรือความเร่งด่วนไม่ถูกต้อง";
  if (
    pr.items.length > 100 ||
    new Set(pr.items.map((item) => item.id)).size !== pr.items.length
  )
    return "รองรับไม่เกิน 100 รายการและรหัสแถวต้องไม่ซ้ำ";
  if (
    pr.items.some(
      (item) =>
        !item.id ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        qty(item.quantity) !== item.quantity ||
        (item.price !== null &&
          (!Number.isFinite(item.price) ||
            item.price < 0 ||
            cents(item.price) / 100 !== item.price ||
            lineAmounts(item, pr.transactionType) === null)),
    )
  )
    return "จำนวนต้องมากกว่า 0 (ไม่เกิน 4 ทศนิยม) และราคาต้องไม่ติดลบ (ไม่เกิน 2 ทศนิยม)";
  if (!Number.isSafeInteger(cents(prAmounts(pr).total)))
    return "ยอดเงินสูงเกินขอบเขตที่รองรับ";
  if (
    pr.requester &&
    !pr.masterRefs?.requester &&
    !prUsers.some(
      (user) => user.name === pr.requester && user.department === pr.department,
    )
  )
    return "ผู้ขอซื้อและแผนกไม่ตรงกับข้อมูลหลักสาธิต";
  if (
    (pr.warehouseCode || pr.warehouseName) &&
    !(
      pr.masterRefs?.warehouse?.value === pr.warehouseCode &&
      pr.masterRefs.warehouse.name === pr.warehouseName
    ) &&
    !prWarehouses.some(
      (warehouse) =>
        warehouse.code === pr.warehouseCode &&
        warehouse.name === pr.warehouseName,
    )
  )
    return "รหัสคลังไม่ตรงกับชื่อคลัง";
  if (
    pr.approver &&
    !pr.masterRefs?.approver &&
    !prUsers.slice(2).some((user) => user.name === pr.approver)
  )
    return "กรุณาเลือกผู้อนุมัติจากข้อมูลสาธิต";
  if (
    pr.items.some(
      (item) =>
        (item.code &&
          !prMaterials.some(
            (material) =>
              material.code === item.code &&
              material.name === item.name &&
              (material.unit === item.unit ||
                pr.masterRefs?.[`unit:${item.id}`]?.value === item.unit),
          )) ||
        ((item.supplierCode || item.supplierName) &&
          !(
            pr.masterRefs?.[`supplier:${item.id}`]?.value ===
              item.supplierCode &&
            pr.masterRefs[`supplier:${item.id}`].name === item.supplierName
          ) &&
          !prSuppliers.some(
            (supplier) =>
              supplier.code === item.supplierCode &&
              supplier.name === item.supplierName,
          )),
    )
  )
    return "สินค้า หน่วย หรือผู้ขายไม่ตรงกับข้อมูลหลัก";
  if (
    submit &&
    (!pr.requester ||
      !pr.department ||
      !pr.warehouseCode ||
      !pr.category.trim() ||
      !pr.neededDate ||
      !pr.purpose.trim() ||
      !pr.approver ||
      !pr.items.length ||
      pr.items.some(
        (item) => !item.code || !item.name.trim() || !item.unit.trim(),
      ))
  )
    return "กรุณากรอกผู้ขอซื้อ คลัง ประเภท กำหนดใช้ วัตถุประสงค์ ผู้อนุมัติ และสินค้าให้ครบ";
  return null;
}
export type PRAction = "submit" | "approve" | "reject" | "cancel" | "close";
export const actionRules: Record<PRAction, { from: PRStatus[]; to: PRStatus }> =
  {
    submit: { from: ["draft", "rejected"], to: "pending_approval" },
    approve: { from: ["pending_approval"], to: "approved" },
    reject: { from: ["pending_approval"], to: "rejected" },
    cancel: {
      from: ["draft", "pending_approval", "approved", "partial_po_created"],
      to: "cancelled",
    },
    close: { from: ["fully_po_created"], to: "closed" },
  };
export function eventFor(
  pr: PR,
  action: string,
  actor: string,
  note: string,
  changes: PRChange[] = [],
): PREvent {
  if (actor !== demoPRUser.name && !prUsers.some((user) => user.name === actor))
    throw new Error("ไม่พบผู้ดำเนินการสาธิต");
  return {
    id: crypto.randomUUID(),
    action,
    actor,
    at: new Date().toISOString(),
    note: note.trim(),
    from: pr.status,
    to: pr.status,
    changes,
  };
}
export function transitionPR(
  pr: PR,
  action: PRAction,
  actor: string,
  note = "",
): PR {
  const rule = actionRules[action];
  if (!rule.from.includes(pr.status))
    throw new Error("สถานะนี้ไม่อนุญาตให้ดำเนินการ");
  if (action === "submit") {
    const error = validatePR(pr);
    if (error) throw new Error(error);
  }
  if (
    (action === "approve" || action === "reject") &&
    actor !== pr.approver &&
    actor !== demoPRUser.name
  )
    throw new Error("ผู้ใช้นี้ไม่มีสิทธิ์อนุมัติเอกสารนี้ในโหมดสาธิต");
  if ((action === "reject" || action === "cancel") && !note.trim())
    throw new Error("กรุณาระบุเหตุผล");
  const event = eventFor(pr, action, actor, note, [
    {
      field: "สถานะ",
      before: statusLabel[pr.status],
      after: statusLabel[rule.to],
    },
  ]);
  return {
    ...pr,
    status: rule.to,
    revision: pr.revision + 1,
    history: [...pr.history, { ...event, to: rule.to }],
  };
}
export function createDemoPO(
  pr: PR,
  quantities: Record<string, number>,
  actor: string,
): PR {
  if (!["approved", "partial_po_created"].includes(pr.status))
    throw new Error("สร้าง PO ได้เมื่ออนุมัติแล้วและยังมียอดค้างซื้อ");
  if (
    Object.keys(quantities).some(
      (id) => !pr.items.some((item) => item.id === id),
    )
  )
    throw new Error("ไม่พบรายการขอซื้อ");
  const lines = pr.items.map((item) => ({
    itemId: item.id,
    quantity: quantities[item.id] ?? 0,
  }));
  if (
    lines.some(
      (line) =>
        !Number.isFinite(line.quantity) ||
        line.quantity < 0 ||
        qty(line.quantity) !== line.quantity ||
        line.quantity >
          remainingQuantity(pr.items.find((item) => item.id === line.itemId)!),
    )
  )
    throw new Error(
      "จำนวนออก PO ต้องไม่ติดลบและไม่เกินยอดคงเหลือ (ไม่เกิน 4 ทศนิยม)",
    );
  const ordered = lines.filter((line) => line.quantity > 0);
  if (!ordered.length)
    throw new Error("กรุณาระบุจำนวนที่จะออก PO อย่างน้อยหนึ่งรายการ");
  const items = pr.items.map((item) => ({
    ...item,
    orderedQuantity: qty(item.orderedQuantity + (quantities[item.id] ?? 0)),
  }));
  const status: PRStatus = items.every((item) => remainingQuantity(item) === 0)
    ? "fully_po_created"
    : "partial_po_created";
  const po: DemoPO = {
    id: crypto.randomUUID(),
    number: `PO-DEMO-${pr.number}-${String(pr.purchaseOrders.length + 1).padStart(2, "0")}`,
    at: new Date().toISOString(),
    actor,
    lines: ordered,
  };
  const event = eventFor(
    pr,
    "create_po",
    actor,
    po.number,
    ordered.map((line) => {
      const item = pr.items.find((item) => item.id === line.itemId)!;
      return {
        field: `ออก PO สะสม · รายการ ${pr.items.indexOf(item) + 1} · ${item.name} (${item.unit})`,
        before: String(item.orderedQuantity),
        after: String(qty(item.orderedQuantity + line.quantity)),
      };
    }),
  );
  event.changes.push({
    field: "สถานะ",
    before: statusLabel[pr.status],
    after: statusLabel[status],
  });
  return {
    ...pr,
    status,
    items,
    purchaseOrders: [...pr.purchaseOrders, po],
    revision: pr.revision + 1,
    history: [...pr.history, { ...event, to: status }],
  };
}
const headerLabels = {
  date: "วันที่เอกสาร",
  requester: "ผู้ขอซื้อ",
  department: "แผนก",
  warehouseCode: "รหัสคลัง",
  warehouseName: "คลัง",
  category: "ประเภท",
  transactionType: "ธุรกรรม",
  referenceNo: "อ้างอิง",
  priority: "ความเร่งด่วน",
  neededDate: "กำหนดใช้",
  purpose: "วัตถุประสงค์",
  remarks: "หมายเหตุ",
  approver: "ผู้อนุมัติ",
} as const;
export function prChanges(before: PR, after: PR): PRChange[] {
  const changes: PRChange[] = [];
  for (const key of Object.keys(headerLabels) as (keyof typeof headerLabels)[])
    if (before[key] !== after[key])
      changes.push({
        field: headerLabels[key],
        before: before[key] || "—",
        after: after[key] || "—",
      });
  const itemLabels = {
    code: "รหัสสินค้า",
    name: "สินค้า",
    supplierCode: "รหัสผู้ขาย",
    supplierName: "ผู้ขาย",
    specification: "สเปก",
    quantity: "จำนวน",
    unit: "หน่วย",
    price: "ราคา",
    remarks: "หมายเหตุ",
  } as const;
  for (const item of after.items) {
    const old = before.items.find((row) => row.id === item.id);
    if (!old)
      changes.push({
        field: `เพิ่มรายการ ${after.items.indexOf(item) + 1}`,
        before: "—",
        after: `${item.name || "ยังไม่ระบุ"} · ${item.quantity} ${item.unit} · ราคา ${item.price ?? "ไม่ระบุ"}`,
      });
    else
      for (const key of Object.keys(itemLabels) as (keyof typeof itemLabels)[])
        if (old[key] !== item[key])
          changes.push({
            field: `รายการ ${after.items.indexOf(item) + 1} · ${item.name || item.id} · ${itemLabels[key]}`,
            before: String(old[key] ?? "—"),
            after: String(item[key] ?? "—"),
          });
  }
  before.items
    .filter((item) => !after.items.some((row) => row.id === item.id))
    .forEach((item) =>
      changes.push({
        field: `ลบรายการ ${before.items.indexOf(item) + 1}`,
        before: `${item.name || "ยังไม่ระบุ"} · ${item.quantity} ${item.unit}`,
        after: "—",
      }),
    );
  return changes;
}
export function copyPR(pr: PR): PR {
  return {
    ...structuredClone(pr),
    id: "",
    number: "",
    status: "draft",
    revision: 0,
    history: [],
    purchaseOrders: [],
    referenceNo: pr.number,
    items: pr.items.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      orderedQuantity: 0,
    })),
  };
}
export function nextPRNumber(records: PR[], date: string) {
  const prefix = `PR-${date.replaceAll("-", "")}-`;
  const max = Math.max(
    0,
    ...records
      .filter((pr) => pr.number.startsWith(prefix))
      .map((pr) => Number(pr.number.slice(prefix.length)))
      .filter(Number.isFinite),
  );
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}
export function createPRRecord(
  draft: PR,
  records: PR[],
  actor: string,
  submit = false,
  imported = false,
): PR {
  const issue = validatePR(draft, submit);
  if (issue) throw new Error(issue);
  const doc: PR = {
    ...structuredClone(draft),
    id: `pr-${crypto.randomUUID()}`,
    number: nextPRNumber(records, draft.date),
    status: "draft",
    revision: 1,
    history: [],
    purchaseOrders: [],
    items: draft.items.map((item) => ({ ...item, orderedQuantity: 0 })),
  };
  const event = eventFor(
    doc,
    imported ? "import" : "create",
    actor,
    imported ? "นำเข้าข้อมูลตัวอย่าง (ไม่อ่านไฟล์ Excel)" : "สร้างฉบับร่าง",
    [{ field: "เลขที่ PR", before: "—", after: doc.number }],
  );
  doc.history = [{ ...event, from: null }];
  return submit ? transitionPR(doc, "submit", actor) : doc;
}
export function savePRRecord(
  old: PR,
  draft: PR,
  actor: string,
  submit = false,
): PR {
  if (!["draft", "rejected"].includes(old.status))
    throw new Error("เอกสารนี้แก้ไขไม่ได้");
  if (old.revision !== draft.revision)
    throw new Error("เอกสารเปลี่ยนแล้ว กรุณากลับเปิดหน้าแก้ไขใหม่");
  const issue = validatePR(draft, submit);
  if (issue) throw new Error(issue);
  const changes = prChanges(old, draft);
  const updated: PR = {
    ...structuredClone(draft),
    id: old.id,
    number: old.number,
    status: old.status,
    revision: old.revision + 1,
    purchaseOrders: old.purchaseOrders,
    items: draft.items.map((item) => ({ ...item, orderedQuantity: 0 })),
    history: changes.length
      ? [...old.history, eventFor(old, "edit", actor, "แก้ไขข้อมูล", changes)]
      : old.history,
  };
  return submit ? transitionPR(updated, "submit", actor) : updated;
}
export function deletePREvent(pr: PR, actor: string): PREvent {
  if (pr.status !== "draft") throw new Error("ลบได้เฉพาะฉบับร่าง");
  return eventFor(pr, "delete", actor, "ลบฉบับร่างสาธิต", [
    { field: "เอกสาร", before: pr.number, after: "ลบแล้ว" },
  ]);
}
export function batchPRRecords(
  records: PR[],
  ids: string[],
  action: PRAction,
  actor: string,
  note = "",
): PR[] {
  if (!ids.length) throw new Error("กรุณาเลือกเอกสาร");
  const updates = new Map(
    [...new Set(ids)].map((id) => {
      const old = records.find((pr) => pr.id === id);
      if (!old) throw new Error("ไม่พบ PR");
      return [id, transitionPR(old, action, actor, note)];
    }),
  );
  return records.map((pr) => updates.get(pr.id) ?? pr);
}
export function filterPRs(
  records: PR[],
  filters: { search: string; status: string; from: string; to: string },
) {
  const search = filters.search.trim().toLocaleLowerCase("th-TH");
  return records.filter(
    (pr) =>
      [
        pr.number,
        pr.requester,
        pr.warehouseName,
        pr.referenceNo,
        ...pr.items.map((item) => item.name),
      ]
        .join(" ")
        .toLocaleLowerCase("th-TH")
        .includes(search) &&
      (filters.status === "all" || pr.status === filters.status) &&
      (!filters.from || pr.date >= filters.from) &&
      (!filters.to || pr.date <= filters.to),
  );
}
export const demoPRs: PR[] = [
  {
    ...newPR(),
    id: "pr-1",
    number: "PR-20261015-0001",
    requester: "พนักงานฝ่ายผลิต",
    department: "ฝ่ายผลิต",
    warehouseCode: "WH01",
    warehouseName: "คลังหลัก",
    category: "วัตถุดิบ",
    neededDate: "2026-10-20",
    purpose: "เติมวัตถุดิบสำหรับการผลิต",
    approver: "หัวหน้าแผนก",
    items: [{ ...materialItem("RM-001", "line1"), quantity: 100 }],
  },
  {
    ...newPR(),
    id: "pr-2",
    number: "PR-20261014-0002",
    date: "2026-10-14",
    requester: "พนักงานคลัง",
    department: "คลังสินค้า",
    warehouseCode: "WH02",
    warehouseName: "คลังรอง",
    category: "วัสดุ",
    neededDate: "2026-10-21",
    purpose: "สำรองวัสดุ",
    approver: "ผู้จัดการ",
    status: "approved",
    items: [{ ...materialItem("PK-001", "line2"), quantity: 200 }],
    history: [
      {
        id: "event-demo-approved",
        action: "approve",
        actor: "ผู้จัดการ",
        at: "2026-10-14T09:00:00+07:00",
        note: "อนุมัติข้อมูลตัวอย่าง",
        from: "pending_approval",
        to: "approved",
        changes: [
          { field: "สถานะ", before: "รออนุมัติ", after: "อนุมัติแล้ว" },
        ],
      },
    ],
  },
];
export function importExamplePR(): PR {
  const pr = newPR();
  return {
    ...pr,
    requester: "พนักงานคลัง",
    department: "คลังสินค้า",
    warehouseCode: "WH01",
    warehouseName: "คลังหลัก",
    category: "วัสดุ",
    neededDate: "2026-10-22",
    purpose: "นำเข้าข้อมูลตัวอย่างเท่านั้น",
    approver: "ผู้จัดการ",
    referenceNo: "IMPORT-DEMO-001",
    items: [materialItem("RM-002", crypto.randomUUID())],
  };
}
