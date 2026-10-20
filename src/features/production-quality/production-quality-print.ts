import {
  averageFor,
  averageMetricIds,
  displayReading,
  formatDate,
  formatDuration,
  metrics,
  selectedSlots,
  statusLabel,
  timeSlots,
  type Inspection,
} from "./production-quality-domain";
import { qualityProfiles } from "./production-quality-profiles";

export const escapeQualityText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function buildQualityPrintHtml(
  row: Inspection,
  branding: {
    factoryName: string;
    shortName: string;
    logoDataUrl: string | null;
  },
) {
  const text = escapeQualityText;
  const logo =
    branding.logoDataUrl &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      branding.logoDataUrl,
    )
      ? `<img alt="โลโก้โรงงาน" src="${text(branding.logoDataUrl)}">`
      : `<b>${text(branding.shortName)}</b>`;
  const header = `<header>${logo}<div><h1>ตรวจสอบคุณภาพการผลิต</h1><p>${text(branding.factoryName)} · ${text(qualityProfiles[row.profileId].label)}</p></div></header><p><b>ข้อมูลสาธิต · ${text(statusLabel(row))} · ยังไม่มีการประเมินผลอนุมัติรวม</b></p><p>เอกสาร ${text(row.documentNumber)} · ${text(formatDate(row.inspectionDate))} · สถานที่ ${text(row.productionSite)} · สาย ${text(row.productionLine)}</p><p>${row.formulas.map((f) => `${text(f.formulaName)} / Lot ${text(f.lotCode)}`).join(" · ")}</p>`;
  const matrixPages = [0, 7, 14]
    .map((offset, index) => {
      const slots = timeSlots.slice(offset, offset + 7);
      return `<section class="page">${header}<h2>ผลตรวจตามเวลา (${index + 1}/3)</h2><table><thead><tr><th>หัวข้อตรวจ</th>${slots.map((s) => `<th>${s}${timeSlots.indexOf(s) >= 14 ? " (+1 วัน)" : ""}</th>`).join("")}</tr></thead><tbody>${metrics
        .map(
          (m) =>
            `<tr><th>${text(m.id === "dryer_temperature_group_a" ? qualityProfiles[row.profileId].dryerA : m.id === "dryer_temperature_group_b" ? qualityProfiles[row.profileId].dryerB : m.label)}</th>${slots
              .map((s) => {
                const r = row.readings[m.id]?.[s];
                return `<td>${text(displayReading(r))}${r?.note ? `<small>${text(r.note)}</small>` : ""}</td>`;
              })
              .join("")}</tr>`,
        )
        .join(
          "",
        )}</tbody></table><p class="small">ช่วงหลังเที่ยงคืนเป็นวันถัดจากวันที่เอกสาร · ช่องว่างไม่มีค่าตรวจ ไม่ใช่ศูนย์ · ผลแต่ละช่องไม่ใช่การอนุมัติรวม</p></section>`;
    })
    .join("");
  const summaries = row.formulas
    .map(
      (f) =>
        `<h3>${text(f.formulaName)} · Lot ${text(f.lotCode)}</h3><p>${text(f.startTime)} – ${text(f.endTime)} · เพิ่มเติม ${text(f.extraSlots.join(", "))} · เลือก ${selectedSlots(f).length} ช่วง</p><table><thead><tr>${averageMetricIds.map((id) => `<th>${text(metrics.find((m) => m.id === id)!.label)}</th>`).join("")}</tr></thead><tbody><tr>${averageMetricIds
          .map((id) => {
            const n = averageFor(row, id, selectedSlots(f));
            return `<td>${id === "water_solubility" ? formatDuration(n) : n === null ? "—" : n.toFixed(3)}</td>`;
          })
          .join("")}</tr></tbody></table>`,
    )
    .join("");
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Production Quality Demo</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:12px Tahoma,sans-serif;color:#111;background:white;margin:16px}header{display:flex;gap:18px;align-items:center;border-bottom:2px solid #333}header img{max-width:100px;max-height:55px}h1{font-size:20px}h2{font-size:16px}p,td,th{overflow-wrap:anywhere;white-space:pre-wrap}table{width:100%;border-collapse:collapse;table-layout:fixed;margin:10px 0}th,td{border:1px solid #777;padding:7px;vertical-align:top;font-weight:normal}th{background:#eee}th:first-child{width:24%}thead{display:table-header-group}tr{break-inside:avoid}small{display:block;font-size:10px;color:#444;margin-top:4px}.small{font-size:10px}.page{break-after:page;margin-bottom:30px}.last{break-after:auto}h3{break-after:avoid}@media print{body{margin:0}.page{margin:0}}</style></head><body>${matrixPages}<section class="page last">${header}<h2>เครื่องจักรและสรุปการทดสอบ</h2><p>เปิดเครื่อง ${text(row.machineStart)} · เริ่มงาน ${text(row.workStart)} · หยุดงาน ${text(row.workStop)}</p><table><thead><tr><th>หยุด</th><th>เริ่มใหม่</th><th>เหตุผล</th></tr></thead><tbody>${row.stops.map((s) => `<tr><td>${text(s.stop)}</td><td>${text(s.restart)}</td><td>${text(s.reason)}</td></tr>`).join("")}</tbody></table>${summaries}<h2>ข้อมูลผู้ลงชื่อ (ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์)</h2><table><tbody>${row.signers.map((s) => `<tr><th>${text(s.role)}</th><td>${text(s.name)}</td><td>${s.date ? text(formatDate(s.date)) : ""}</td></tr>`).join("")}</tbody></table><h2>หมายเหตุ</h2><p>${text(row.notes)}</p><p class="small">สร้าง ${text(row.createdAt)} · แก้ไข ${text(row.updatedAt)} · เอกสารตัวอย่าง ไม่ใช่หลักฐานการอนุมัติหรือการปล่อยสต็อก</p></section></body></html>`;
}
