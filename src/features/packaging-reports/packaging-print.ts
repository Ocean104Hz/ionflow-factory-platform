import {
  booleanLabel,
  recordLabel,
  thaiDate,
  type PackagingReport,
} from "./packaging-domain";
import { packagingProfiles } from "./packaging-profiles";
export const escapePackagingText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const chunks = <T>(rows: readonly T[], size: number): T[][] =>
  rows.length
    ? Array.from({ length: Math.ceil(rows.length / size) }, (_, i) =>
        rows.slice(i * size, (i + 1) * size),
      )
    : [[]];
export function buildPackagingPrintHtml(
  report: PackagingReport,
  branding: {
    factoryName: string;
    shortName: string;
    logoDataUrl: string | null;
  },
) {
  const e = escapePackagingText,
    p = packagingProfiles[report.profileId];
  const logo =
    branding.logoDataUrl &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      branding.logoDataUrl,
    )
      ? `<img alt="โลโก้โรงงาน" src="${e(branding.logoDataUrl)}">`
      : `<b>${e(branding.shortName)}</b>`;
  const header = (context: string) =>
    `<header>${logo}<div><h1>ใบรายงานการบรรจุปุ๋ยอินทรีย์</h1><p>${e(branding.factoryName)} · ${e(p.label)}</p></div></header><p><b>MOCK · ${e(recordLabel(report))} · ยังไม่มีการประเมินผลอนุมัติรวม</b></p><p>เอกสาร ${e(report.documentNumber)} · วันที่ ${e(thaiDate(report.documentDate))} · สถานที่ ${e(report.location)}</p><h2>${e(context)}</h2>`;
  const row = (cells: string[]) =>
    `<tr>${cells.map((v) => `<td>${e(v)}</td>`).join("")}</tr>`;
  const table = (title: string, heads: string[], body: string) =>
    `<table><thead><tr><th colspan="${heads.length}">${e(report.documentNumber)} · ${e(title)}</th></tr><tr>${heads.map((v) => `<th>${e(v)}</th>`).join("")}</tr></thead><tbody>${body || `<tr><td colspan="${heads.length}">ไม่มีข้อมูล</td></tr>`}</tbody></table>`;
  let pages = "";
  for (const s of report.sets) {
    for (const [index, c] of s.contexts.entries()) {
      const observations = s.inspections.filter((o) => o.contextId === c.id);
      for (const [part, group] of chunks(observations, 6).entries()) {
        const context = `SET ${s.setNo} · บริบท ${index + 1} · ส่วน ${part + 1} · ${c.fertilizerName} / Lot ${c.lotCode}`;
        const heads = [
          "เวลาบรรจุ",
          ...(p.hourlySampling ? ["เวลาสุ่มตรวจ"] : []),
          "น้ำหนัก 1 (kg)",
          "น้ำหนัก 2 (kg)",
          "กายภาพ",
          "จดรหัส",
          "ปิด/เย็บ",
          "ความชื้น (%)",
          "ละลายน้ำ (ค่าเดิม)",
          "ฝุ่น (%)",
        ];
        pages += `<section class="page">${header(context)}<p>สูตร ${e(c.fertilizerName)} · Lot ${e(c.lotCode)} · วันที่ผลิต/บรรจุ ${e(thaiDate(c.productionDate))}</p><p>ประเภท ${e(c.packageType)} · น้ำหนักที่ระบุ ${e(c.packageWeight)} ${e(c.packageUnit)} · จำนวน ${e(c.quantity)}</p>${table(context, heads, group.map((o) => `<tr data-observation-id="${e(o.id)}">${[o.packingTime, ...(p.hourlySampling ? [o.hourlySamplingTime] : []), o.bagWeight1, o.bagWeight2, booleanLabel(o.physicalCondition), booleanLabel(o.bagCodeMarking), booleanLabel(o.bagSealing), o.moisture, o.waterSolubility, o.dust].map((v) => `<td>${e(v)}</td>`).join("")}</tr>`).join(""))}<p class="small">เวลาคือเวลาท้องถิ่น ไม่ใช่ UTC · วันที่ของแต่ละบริบทระบุแยกต่างหาก · ค่าว่างไม่ใช่ศูนย์ · ค่าละลายน้ำคงค่าต้นฉบับ ยังไม่แปลงเป็นระยะเวลา</p></section>`;
      }
    }
    for (const [part, group] of chunks(s.loadCells, 12).entries())
      pages += `<section class="page">${header(`SET ${s.setNo} · Load Cell · ส่วน ${part + 1}`)}${table(`SET ${s.setNo} Load Cell`, ["เวลา", "น้ำหนัก (kg)"], group.map((l) => row([l.time, l.weight])).join(""))}</section>`;
    for (const [part, group] of chunks(s.comparisons, 12).entries())
      pages += `<section class="page">${header(`SET ${s.setNo} · เทียบเครื่องชั่ง Master · ส่วน ${part + 1}`)}${table(`SET ${s.setNo} Master`, ["เวลา", "เครื่อง QC (kg)", "เครื่อง Master (kg)"], group.map((c) => row([c.time, c.qcWeight, c.masterWeight])).join(""))}<p>แนวทางอ้างอิงตรวจทุก 4 ชั่วโมง ไม่ใช่ผลสอบเทียบหรือการอนุมัติอัตโนมัติ</p><h3>หมายเหตุ SET ${s.setNo}</h3><p>${e(s.remarks)}</p></section>`;
  }
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Packaging Report Mock</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:12px Tahoma,sans-serif;color:#111;background:white;margin:16px}header{display:flex;align-items:center;gap:16px;border-bottom:2px solid #333}header img{max-width:100px;max-height:55px}h1{font-size:20px}h2{font-size:16px}p,th,td{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;table-layout:fixed;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #777;padding:7px;vertical-align:top}th{background:#eee;font-weight:normal}thead{display:table-header-group}tr{break-inside:avoid}h2,h3{break-after:avoid}.small{font-size:10px}.page{break-before:page;margin-bottom:25px}.page:first-child{break-before:auto}@media print{body{margin:0}.page{margin:0}}</style></head><body>${pages}<section class="page">${header("ผู้ลงชื่อและหมายเหตุเอกสาร")}${table("ผู้ลงชื่อ", ["บทบาท", "ชื่อสาธิต", "วันที่"], report.signers.map((s) => row([s.role, s.name, s.date ? thaiDate(s.date) : ""])).join(""))}<p>ชื่อเหล่านี้ไม่ใช่ลายมือชื่ออิเล็กทรอนิกส์ และไม่ใช่ผลอนุมัติ QA</p><h3>หมายเหตุเอกสาร</h3><p>${e(report.remarks)}</p><p class="small">สร้าง ${e(report.createdAt)} · แก้ไข ${e(report.updatedAt)} · ไม่มีการเปลี่ยนสต็อก</p></section></body></html>`;
}
