import type { MixingReport } from "./mixing-domain";
export function escapePrintText(value: unknown) {
  return String(value ?? "—").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function buildMixingPrintHtml(
  rows: MixingReport[],
  branding: { factoryName: string; logoDataUrl: string | null },
) {
  const e = escapePrintText;
  const logo =
    branding.logoDataUrl &&
    /^data:image\/(png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(
      branding.logoDataUrl,
    )
      ? `<img alt="โลโก้โรงงาน" src="${e(branding.logoDataUrl)}" width="64" height="64">`
      : "";
  const table = (headers: string[], body: unknown[][]) =>
    `<table><thead><tr>${headers.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${body.map((cells) => `<tr>${cells.map((c) => `<td>${e(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>รายงานผสมปุ๋ยผง</title><style>
    @page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#111;background:#eee;font:12px/1.6 Tahoma,Arial,sans-serif}.report{background:white;max-width:210mm;margin:16px auto;padding:12mm;overflow-wrap:anywhere}.brand{display:flex;gap:16px;align-items:center;border-bottom:2px solid #222;padding-bottom:12px}.brand img{object-fit:contain}h1{font-size:20px;margin:0}h2{font-size:15px;margin:20px 0 8px}.fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:16px 0}.fields div{white-space:pre-wrap}table{border-collapse:collapse;width:100%;table-layout:fixed;margin-bottom:16px}th,td{border:1px solid #aaa;padding:6px;vertical-align:top;white-space:pre-wrap}th{background:#f3f3f3;font-weight:bold}thead{display:table-header-group}tr{break-inside:avoid}.signers{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;break-inside:avoid;margin-top:24px}.signers div{border-top:1px solid #777;padding-top:10px;text-align:center;white-space:pre-wrap}.notice{font-size:10px;color:#555} @media print{body{background:white}.report{max-width:none;margin:0;padding:0;break-after:page}.report:last-child{break-after:auto}}
    </style></head><body>${rows
      .map(
        (r) =>
          `<article class="report"><header class="brand">${logo}<div><strong>${e(branding.factoryName)}</strong><h1>รายงานผสมปุ๋ยผง</h1><span>เลขที่เอกสาร ${e(r.doc_no)}</span></div></header><div class="fields">${[
            ["วันที่รายงาน", r.report_date],
            ["สูตร / ผลิตภัณฑ์", r.fertilizer],
            ["Lot No.", r.lot_no],
            ["กะที่ผลิต", r.shift],
            ["สถานที่ผสม", r.location],
            ["หมายเลขรถตัก", r.loader_no],
            ["ระยะเวลาการผสม (ชั่วโมง)", r.mix_duration],
          ]
            .map(
              ([label, value]) =>
                `<div><strong>${e(label)}:</strong> ${e(value)}</div>`,
            )
            .join(
              "",
            )} </div><h2>วัตถุดิบตามใบสั่งผสม</h2><p class="notice">จำนวนตามแผน ไม่ใช่ยอดใช้จริง · ไม่มีการตัดสต็อก</p>${table(
            ["รหัส", "วัตถุดิบ", "Lot วัตถุดิบ", "จำนวน", "หน่วย"],
            r.materials.map((m) => [
              m.material_code,
              m.material_name,
              m.lot_no,
              m.order_qty,
              m.unit,
            ]),
          )}<h2>รอบผสมและผลตรวจ</h2>${table(
            [
              "รอบ",
              "วันที่ผสม",
              "กะ",
              "จำนวนตัก",
              "ผลตรวจ 6 จุด",
              "ผู้ผสม (รถตัก)",
              "ผู้ควบคุม (QC/หัวหน้า)",
            ],
            r.mix_rounds.map((m, i) => [
              i + 1,
              m.round_date,
              m.shift,
              m.loader_load_count,
              m.is_pass === null
                ? "ยังไม่ตรวจ"
                : m.is_pass
                  ? "ผ่าน"
                  : "ไม่ผ่าน",
              m.operator_mixer,
              m.supervisor,
            ]),
          )}<div class="signers"><div>${e(r.inspector || "ยังไม่ระบุ")}<br>ผู้ตรวจสอบคุณภาพ<br>วันที่ ${e(r.inspector_date || "—")}</div><div>${e(r.production || "ยังไม่ระบุ")}<br>เจ้าหน้าที่ผลิต</div><div>${e(r.factory_qa || "ยังไม่ระบุ")}<br>ผู้จัดการโรงงาน/QA</div></div><p class="notice">เอกสารข้อมูลจำลอง · ผลตรวจต่อรอบไม่ใช่การอนุมัติหรือปฏิเสธทั้งเอกสาร</p></article>`,
      )
      .join("")}</body></html>`;
}
