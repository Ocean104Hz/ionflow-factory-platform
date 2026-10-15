import { lineAmounts, prAmounts, statusLabel, type PR } from "./pr-domain";

export function escapePrintText(value: unknown): string {
  return String(value ?? "—").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
}
const money = (value: number | undefined) =>
  value === undefined
    ? "—"
    : value.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeZone: "Asia/Bangkok",
      }).format(new Date(value))
    : "—";

export function buildPRPrintHtml(
  records: PR[],
  branding: {
    factoryName: string;
    shortName: string;
    logoDataUrl: string | null;
  },
): string {
  const text = escapePrintText;
  const logo =
    branding.logoDataUrl &&
    /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
      branding.logoDataUrl,
    )
      ? `<img alt="โลโก้โรงงาน" src="${text(branding.logoDataUrl)}" />`
      : `<strong class="wordmark">${text(branding.shortName)}</strong>`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>ใบขอซื้อ PR</title><style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #e9edf1; color: #111; font: 12px/1.65 Tahoma, Arial, sans-serif; }
    .sheet { max-width: 210mm; min-height: 270mm; margin: 16px auto; padding: 16mm 12mm; background: white; }
    header { display: flex; align-items: center; gap: 20px; padding-bottom: 12px; border-bottom: 1px solid #555; }
    header img { max-width: 120px; max-height: 65px; object-fit: contain; }
    .wordmark { font-size: 30px; } h1 { font-size: 20px; margin: 22px 0 0; text-align: center; } h2 { font-size: 15px; text-align: center; margin: 2px 0 20px; }
    .company { font-size: 18px; font-weight: bold; } .muted { color: #555; font-size: 11px; }
    .document { text-align: right; margin: 10px 0; } .info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin: 15px 0; } .wide { grid-column: 1 / -1; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 12px; } th, td { border: 1px solid #333; padding: 6px; overflow-wrap: anywhere; vertical-align: top; } th { background: #f1f1f1; font-size: 11px; } .number { text-align: right; font-variant-numeric: tabular-nums; } .center { text-align: center; }
    .summary { display: grid; grid-template-columns: 1fr 255px; border: 1px solid #333; margin-top: 10px; } .notes { white-space: pre-wrap; padding: 10px; border-right: 1px solid #333; } dl { margin: 0; display: grid; grid-template-columns: 1fr 1fr; } dt, dd { margin: 0; padding: 5px 8px; border-bottom: 1px solid #333; } dt:last-of-type, dd:last-of-type { border-bottom: 0; font-weight: bold; } dd { text-align: right; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; text-align: center; margin-top: 35px; } .signature-line { margin: 25px 10px 8px; border-top: 1px dotted #555; padding-top: 6px; } footer { border-top: 1px solid #aaa; margin-top: 25px; padding-top: 8px; font-size: 10px; color: #555; }
    thead { display: table-header-group; } tr, .summary, .signatures { break-inside: avoid; }
    @media print { body { background: white; } .sheet { max-width: none; min-height: auto; margin: 0; padding: 0; break-after: page; } .sheet:last-child { break-after: auto; } }
  </style></head><body>${records
    .map((pr) => {
      const totals = prAmounts(pr);
      const approval = [...pr.history]
        .reverse()
        .find((event) => event.action === "approve");
      return `<article class="sheet"><header>${logo}<div><div class="company">${text(branding.factoryName)}</div><div class="muted">เอกสารภายในโรงงาน · ข้อมูลสาธิต</div></div></header>
      <h1>ใบขอซื้อ</h1><h2>PURCHASE REQUISITION</h2>
      <div class="document">วันที่: ${text(date(pr.date))}<br><strong>เลขที่ใบขอซื้อ: ${text(pr.number)}</strong><br>สถานะ: ${text(statusLabel[pr.status])} · Rev. ${pr.revision}</div>
      <div class="info"><div><strong>ผู้ขอซื้อ:</strong> ${text(pr.requester || "—")}</div><div><strong>ฝ่าย/แผนก:</strong> ${text(pr.department || "—")}</div><div><strong>คลัง / สถานที่:</strong> ${text(`${pr.warehouseCode} ${pr.warehouseName}`)}</div><div><strong>วันที่ต้องการใช้:</strong> ${text(date(pr.neededDate))}</div><div><strong>เลขที่อ้างอิง:</strong> ${text(pr.referenceNo || "—")}</div><div><strong>ประเภทธุรกรรม:</strong> ${text(pr.transactionType)}</div><div class="wide"><strong>วัตถุประสงค์:</strong> ${text(pr.purpose || "—")}</div></div>
      <table><thead><tr><th style="width:6%">ลำดับ</th><th style="width:15%">รหัสสินค้า</th><th style="width:31%">รายการ / รายละเอียด</th><th style="width:10%">จำนวน</th><th style="width:8%">หน่วย</th><th style="width:14%">ราคาต่อหน่วย</th><th style="width:16%">จำนวนเงิน</th></tr></thead><tbody>${pr.items.map((item, index) => `<tr><td class="center">${index + 1}</td><td>${text(item.code || "—")}</td><td>${text(item.name || "—")}${item.specification ? `<br><span class="muted">${text(item.specification)}</span>` : ""}${item.supplierName ? `<br><span class="muted">ผู้ขาย: ${text(item.supplierName)}</span>` : ""}${item.remarks ? `<br>${text(item.remarks)}` : ""}</td><td class="number">${text(item.quantity.toLocaleString("th-TH"))}</td><td class="center">${text(item.unit || "—")}</td><td class="number">${text(money(item.price ?? undefined))}</td><td class="number">${text(money(lineAmounts(item, pr.transactionType)?.subtotal))}</td></tr>`).join("")}</tbody></table>
      <div class="summary"><div class="notes"><strong>หมายเหตุ</strong>\n${text(pr.remarks || "—")}\n${totals.complete ? "" : "ยังระบุราคาไม่ครบ ยอดก่อนภาษีเป็นเฉพาะรายการที่ระบุราคาแล้ว"}</div><dl><dt>ยอดก่อนภาษี</dt><dd>${text(money(totals.subtotal))}</dd><dt>ภาษีสาธิต ${pr.transactionType === "VAT" ? "7%" : "0%"}</dt><dd>${text(money(totals.tax))}</dd><dt>ยอดรวม (บาท)</dt><dd>${totals.complete ? text(money(totals.total)) : "ยังไม่ครบ"}</dd></dl></div>
      <div class="signatures"><div><div class="signature-line">ผู้ขอซื้อ</div>${text(pr.requester || "—")}<br>วันที่ __________________</div><div><div class="signature-line">ผู้อนุมัติที่กำหนด</div>${text(pr.approver || "—")}<br>${approval ? `บันทึกอนุมัติโดย ${text(approval.actor)} · ${text(date(approval.at))}` : "วันที่ __________________"}</div></div>
      <footer>เอกสารสาธิตจาก Factory Platform · ไม่ใช่ใบสั่งซื้อ (PO) · ไม่มีการส่งคำสั่งซื้อให้ผู้ขาย</footer></article>`;
    })
    .join("")}</body></html>`;
}
