import {
  inspectionChecks,
  inspectionStatus,
  type Inspection,
} from "./inspection-domain";

const text = (value: string) =>
  (value || "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const date = (value: string) =>
  value && !Number.isNaN(Date.parse(value))
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${value}T00:00:00+07:00`))
    : "—";

export function buildInspectionPrintHtml(
  row: Inspection,
  branding: {
    factoryName: string;
    shortName: string;
    logoDataUrl: string | null;
  },
  unsaved = false,
) {
  const logo =
    branding.logoDataUrl &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      branding.logoDataUrl,
    )
      ? `<img alt="โลโก้โรงงาน" src="${text(branding.logoDataUrl)}">`
      : `<strong>${text(branding.shortName)}</strong>`;
  const field = (label: string, value: string) =>
    `<div><b>${label}</b> ${text(value)}</div>`;
  const result = {
    pending: "ยังไม่ตรวจ",
    pass: "ผ่าน",
    fail: "ไม่ผ่าน",
    na: "ไม่เกี่ยวข้อง",
  };
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>ใบตรวจสอบคุณภาพวัตถุดิบ ${text(row.number)}</title><style>
    @page { size: A5 landscape; margin: 6mm; }
    * { box-sizing: border-box; } body { margin: 0; background: #e9edf1; color: #111; font: 11px/1.45 Tahoma, Arial, sans-serif; }
    .paper { background: white; max-width: 210mm; margin: 16px auto; padding: 8mm; overflow-wrap: anywhere; }
    header { display: flex; align-items: center; justify-content: center; gap: 16px; border: 1px solid; padding: 10px; text-align: center; }
    header img { max-width: 90px; max-height: 42px; } h1 { font-size: 17px; margin: 3px 0; } header p { margin: 0; }
    .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; padding: 10px; border: 1px solid; border-top: 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; } th, td { border: 1px solid; padding: 6px; vertical-align: top; white-space: pre-wrap; } th { background: #f2f3f4; }
    thead { display: table-header-group; } tr { break-inside: avoid; } .signatures { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid; border-top: 0; break-inside: avoid; text-align: center; }
    .signatures div { padding: 14px 8px; } .signatures p { margin: 3px 0; } footer { margin-top: 8px; font-size: 9px; text-align: right; }
    @media print { body { background: white; } .paper { max-width: none; margin: 0; padding: 0; } }
  </style></head><body><main class="paper"><header>${logo}<div><p>${text(branding.factoryName)}</p><h1>ใบตรวจสอบคุณภาพวัตถุดิบ</h1><p>ผลการตรวจ: ${text(inspectionStatus(row))}${unsaved ? " · สำเนาจากฟอร์มที่ยังไม่ได้บันทึก" : ""}</p></div></header>
  <section class="fields">${field("โรงงาน / สถานที่ตรวจ", row.location)}${field("เลขที่เอกสาร", row.number)}${field("ชื่อผู้ส่ง", row.sender)}${field("วันที่เอกสาร", date(row.date))}${field("วัตถุดิบ", row.material)}${field("Lot No.", row.lot)}${field("เอกสารอ้างอิง", row.reference)}${field("เที่ยวรถ", row.trip)}</section>
  <table><colgroup><col style="width:24%"><col style="width:30%"><col style="width:14%"><col style="width:32%"></colgroup><thead><tr><th>รายการตรวจ</th><th>เกณฑ์ / คำอธิบาย</th><th>ผลการประเมิน</th><th>ค่าที่วัดได้ / หมายเหตุ</th></tr></thead><tbody>${inspectionChecks.map(({ key, label, hint }) => `<tr><td>${text(label)}</td><td>${text(hint)}</td><td>${text(result[row.checks[key].result])}</td><td>${text(row.checks[key].note)}</td></tr>`).join("")}</tbody></table>
  <section class="signatures"><div><p>${text(row.inspector)} / ${date(row.inspectorDate)}</p><p>ผู้ตรวจสอบคุณภาพ / วันที่</p></div><div><p>${text(row.approver)} / ${date(row.approverDate)}</p><p>ผู้อนุมัติ / วันที่ (ตามข้อมูลที่ระบุ)</p></div></section><footer>เอกสารสาธิต · ไม่ใช่ลายเซ็นหรือการอนุมัติจริง · เกณฑ์เฉพาะวัตถุดิบให้ระบุในหมายเหตุ</footer></main></body></html>`;
}
