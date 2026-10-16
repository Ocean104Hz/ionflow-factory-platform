import {
  blankMaster,
  type MasterKind,
  type MasterRow,
  type MasterState,
} from "@/src/features/master-data/master-domain";
import { demoMasterSettings } from "./master-settings";
import { demoUsers } from "./settings";
import { prUsers } from "@/src/features/purchase-requisitions/pr-domain";
const make = (
  kind: MasterKind,
  id: string,
  code: string,
  name: string,
  patch: Partial<MasterRow> = {},
): MasterRow => ({ ...blankMaster(kind, id), code, name, ...patch });
export const internalMasters: MasterState = {
  used: [],
  personnel: [
    ...demoUsers.map((p) => ({ ...p })),
    ...prUsers.map((p, i) => ({
      id: `internal-person-${i}`,
      displayName: p.name,
      email: p.email,
      department: p.department,
      role: i >= 2 ? "หัวหน้าแผนก" : "พนักงาน",
      active: true,
      modules: [],
    })),
  ],
  rows: [
    ...demoMasterSettings.departments.map((r) => ({
      ...blankMaster("departments", r.id),
      ...r,
      kind: "departments" as const,
      aliases: r.name === "การผลิต" ? ["ฝ่ายผลิต", "ผลิต"] : [],
    })),
    ...demoMasterSettings.warehouses.map((r) => ({
      ...blankMaster("warehouses", r.id),
      ...r,
      kind: "warehouses" as const,
      aliases:
        r.code === "WH01" ? ["คลังหลัก"] : r.code === "WH02" ? ["คลังรอง"] : [],
    })),
    make("sites", "site-demo", "FAC-01", "โรงงานสาธิต"),
    make("areas", "area-1", "MIX-01", "DEMO อาคารผสม 1", {
      parentId: "site-demo",
    }),
    make("areas", "area-2", "MIX-02", "DEMO อาคารผสม 2", {
      parentId: "site-demo",
    }),
    make("areas", "area-3", "LAB-01", "DEMO พื้นที่ทดลอง", {
      parentId: "site-demo",
    }),
    make("lines", "line-1", "LINE-01", "DEMO Line 1", {
      parentId: "site-demo",
    }),
    make("shifts", "shift-day", "DAY", "เช้า", {
      start: "08:00",
      end: "20:00",
    }),
    make("shifts", "shift-night", "NIGHT", "ดึก", {
      start: "20:00",
      end: "08:00",
    }),
    make("shifts", "shift-both", "DAY-NIGHT", "เช้า-ดึก", {
      start: "08:00",
      end: "07:59",
    }),
    make("shifts", "shift-both2", "NIGHT-DAY", "ดึก-เช้า", {
      start: "20:00",
      end: "19:59",
    }),
    make("vehicleTypes", "type-loader", "LOADER", "รถตัก", { type: "รถตัก" }),
    make("vehicleTypes", "type-forklift", "FORKLIFT", "รถยก", { type: "รถยก" }),
    make("vehicles", "loader-1", "DEMO-1", "DEMO-1", {
      typeId: "type-loader",
      parentId: "site-demo",
    }),
    make("vehicles", "loader-2", "DEMO-2", "DEMO-2", {
      typeId: "type-loader",
      parentId: "site-demo",
    }),
    make("equipment", "machine-1", "MACHINE-01", "เครื่องผสม DEMO", {
      parentId: "line-1",
    }),
    ...[
      ["unit-kg", "KG", "กิโลกรัม", ["kg"]],
      ["unit-piece", "PCS", "ชิ้น", []],
      ["unit-bag", "BAG", "กระสอบ", []],
      ["unit-sheet", "EA", "ใบ", []],
      ["unit-ton", "TON", "ตัน", []],
    ].map(([id, code, name, aliases]) =>
      make("units", String(id), String(code), String(name), {
        aliases: aliases as string[],
      }),
    ),
    make("categories", "category-1", "SAMPLE", "วัสดุตัวอย่าง"),
    make("brands", "brand-demo", "DEMO", "DEMO"),
    make("processes", "process-mix", "MIX", "ผสม"),
    make("suppliers", "supplier-1", "SUP-01", "ผู้ขายตัวอย่าง"),
    make("suppliers", "supplier-2", "SUP-02", "ผู้ขายสาธิต 2"),
  ],
};
