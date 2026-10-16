import type { PR } from "@/src/features/purchase-requisitions/pr-domain";
import type { Master, Formula } from "@/src/features/bom/bom-domain";
import type { MixingReport } from "@/src/features/fertilizer-powder-mixing/mixing-domain";
import type { Inspection } from "@/src/features/raw-material-inspections/inspection-domain";
import type { ReferenceField, MasterReferences } from "./master-domain";
export function prFields(row: PR): Record<string, ReferenceField> {
  return {
    requester: { kind: "personnel", value: row.requester },
    approver: { kind: "personnel", value: row.approver },
    department: { kind: "departments", value: row.department },
    warehouse: { kind: "warehouses", value: row.warehouseCode },
    ...Object.fromEntries(
      row.items.flatMap((i) => [
        [`supplier:${i.id}`, { kind: "suppliers", value: i.supplierCode }],
        [`unit:${i.id}`, { kind: "units", value: i.unit }],
      ]),
    ),
  };
}
export function bomFields(row: Master): Record<string, ReferenceField> {
  return {
    unit: { kind: "units", value: row.unit },
    department: { kind: "departments", value: row.department },
    category: { kind: "categories", value: row.category },
    brand: { kind: "brands", value: row.brand },
    process: { kind: "processes", value: row.process },
  };
}
export function formulaFields(row: Formula): Record<string, ReferenceField> {
  return {
    unit: { kind: "units", value: row.unit },
    ...Object.fromEntries(
      [...row.ingredients, ...row.packaging].map((r, i) => [
        `component:${i}`,
        { kind: "units", value: r.unit },
      ]),
    ),
  };
}
export function mixingFields(
  row: MixingReport,
): Record<string, ReferenceField> {
  return {
    location: { kind: "areas", value: row.location },
    loader_no: { kind: "vehicles", value: row.loader_no },
    shift: { kind: "shifts", value: row.shift },
    inspector: { kind: "personnel", value: row.inspector },
    production: { kind: "personnel", value: row.production },
    factory_qa: { kind: "personnel", value: row.factory_qa },
    ...Object.fromEntries(
      row.mix_rounds.map((r) => [
        `shift:${r.id}`,
        { kind: "shifts", value: r.shift },
      ]),
    ),
  };
}
export function inspectionFields(
  row: Inspection,
): Record<string, ReferenceField> {
  return {
    sender: {
      kind: "suppliers",
      value: row.masterRefs?.sender?.value === row.sender ? row.sender : "",
    },
    location: { kind: "areas", value: row.location },
    inspector: { kind: "personnel", value: row.inspector },
    approver: { kind: "personnel", value: row.approver },
  };
}
// Unmapped legacy values remain readable/editable only while unchanged; never guess their identity.
export function fieldsForSave(
  fields: Record<string, ReferenceField>,
  previous: Record<string, ReferenceField> = {},
  refs: MasterReferences = {},
) {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([key, field]) =>
        !field.value || refs[key] || previous[key]?.value !== field.value,
    ),
  );
}
