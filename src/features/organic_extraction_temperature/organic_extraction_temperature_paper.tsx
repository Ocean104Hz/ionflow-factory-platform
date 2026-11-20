import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import {
  ORGANIC_EXTRACTION_FORM_TITLE,
  ORGANIC_EXTRACTION_MACHINES,
  ORGANIC_EXTRACTION_TEMPERATURE_MINUTES,
  formatOrganicExtractionDate,
  type OrganicExtractionMachineValues,
  type OrganicExtractionProductionRound,
  type OrganicExtractionTemperatureSheet,
} from "./organic_extraction_temperature_domain";

type Props = {
  sheet: OrganicExtractionTemperatureSheet;
};

const labels = {
  company: "บริษัท ไอออนิค จำกัด",
  factory: "โรงงานกาญจนบุรี 2",
  documentDate: "วันที่เอกสาร",
  roundOne: "รอบการผลิตที่ 1 (ฝั่งซ้าย)",
  roundTwo: "รอบการผลิตที่ 2 (ฝั่งขวา)",
  productionName: "รายการผลิต",
  startTime: "เวลาเริ่ม",
  endTime: "เวลาสิ้นสุด",
  number: "ลำดับ",
  code: "รหัสวัตถุดิบ",
  material: "ชื่อวัตถุดิบ",
  unit: "หน่วย",
  usage: "การใช้วัตถุดิบ",
  remark: "หมายเหตุ",
  temperature: "อุณหภูมิ",
  minute: "นาที",
  ph: "ค่า pH",
  prepared: "ผู้จัดทำ",
  inspected: "ผู้ตรวจสอบ",
} as const;

const headerCellClass = [
  "!h-auto border border-black !bg-white",
  "!px-[0.5mm] !py-[0.6mm] text-center align-middle",
  "!whitespace-normal text-[8px] font-semibold leading-tight !text-black",
].join(" ");

const bodyCellClass = [
  "h-[4.6mm] border border-black !px-[0.7mm] !py-[0.4mm]",
  "align-middle !whitespace-pre-wrap text-[8px] leading-tight",
  "break-words [overflow-wrap:anywhere] !text-black",
].join(" ");

const numberCellClass = `${bodyCellClass} text-right tabular-nums`;

function formatPaperNumber(value: string): string {
  const text = value.trim();
  if (!text) {
    return "";
  }

  const normalized = text.replaceAll(",", "");
  const match = /^(-?)(\d+)(\.\d+)?$/.exec(normalized);
  if (!match) {
    return text;
  }

  const [, sign, integerPart, decimalPart = ""] = match;
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}${decimalPart}`;
}

function ProductionHeader({
  label,
  round,
}: {
  label: string;
  round: OrganicExtractionProductionRound | undefined;
}) {
  return (
    <section className="min-w-0 space-y-[1mm] text-[8px] leading-tight">
      <h3 className="text-center text-[9px] font-semibold">{label}</h3>
      <p className="flex min-w-0 gap-1">
        <span className="shrink-0">{labels.productionName}:</span>
        <span className="min-w-0 flex-1 border-b border-dotted border-black text-center">
          {round?.production_name.trim() || " "}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-[2mm]">
        <p className="flex min-w-0 gap-1">
          <span className="shrink-0">{labels.startTime}:</span>
          <span className="min-w-0 flex-1 border-b border-dotted border-black text-center tabular-nums">
            {round?.start_time.trim() || " "}
          </span>
        </p>
        <p className="flex min-w-0 gap-1">
          <span className="shrink-0">{labels.endTime}:</span>
          <span className="min-w-0 flex-1 border-b border-dotted border-black text-center tabular-nums">
            {round?.end_time.trim() || " "}
          </span>
        </p>
      </div>
    </section>
  );
}

function MachineValueCells({
  values,
}: {
  values: OrganicExtractionMachineValues | undefined;
}) {
  return (
    <>
      {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
        <TableCell key={machine} className={numberCellClass}>
          {formatPaperNumber(values?.[machine] ?? "")}
        </TableCell>
      ))}
    </>
  );
}

function RoundColumnHeaders() {
  return (
    <>
      {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
        <TableHead key={machine} className={headerCellClass} scope="col">
          {machine}
        </TableHead>
      ))}
      <TableHead className={headerCellClass} scope="col">
        {labels.remark}
      </TableHead>
    </>
  );
}

function PaperColumns() {
  return (
    <colgroup>
      <col className="w-[4%]" />
      <col className="w-[7%]" />
      <col className="w-[13%]" />
      <col className="w-[4%]" />
      {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
        <col key={`first-${machine}`} className="w-[4.5%]" />
      ))}
      <col className="w-[9%]" />
      {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
        <col key={`second-${machine}`} className="w-[4.5%]" />
      ))}
      <col className="w-[9%]" />
    </colgroup>
  );
}

export function OrganicExtractionTemperaturePaper({ sheet }: Props) {
  const roundOne = sheet.rounds.find((round) => round.round_number === 1);
  const roundTwo = sheet.rounds.find((round) => round.round_number === 2);

  return (
    <article
      aria-label={ORGANIC_EXTRACTION_FORM_TITLE}
      className={[
        "mx-auto box-border w-[277mm] min-h-[190mm]",
        "bg-white px-[4mm] pb-[4mm] pt-[3mm] text-black shadow-md",
        "print:m-0 print:shadow-none",
      ].join(" ")}
    >
      <div className="flex min-h-[182mm] flex-col">
        <header className="shrink-0">
          <div className="space-y-[0.5mm] text-center leading-tight">
            <p className="text-[10px] font-semibold">{labels.company}</p>
            <p className="text-[9px]">{labels.factory}</p>
            <h2 className="text-[11px] font-bold">
              {ORGANIC_EXTRACTION_FORM_TITLE}
            </h2>
          </div>

          <div className="mt-[2mm] grid grid-cols-[20%_1fr_1fr] items-start gap-[3mm]">
            <p className="flex min-w-0 gap-1 pt-[2mm] text-[9px]">
              <span className="shrink-0">{labels.documentDate}:</span>
              <span className="min-w-0 flex-1 border-b border-dotted border-black text-center tabular-nums">
                {formatOrganicExtractionDate(sheet.document_date) || " "}
              </span>
            </p>
            <ProductionHeader label={labels.roundOne} round={roundOne} />
            <ProductionHeader label={labels.roundTwo} round={roundTwo} />
          </div>
        </header>

        <section className="mt-[3mm] min-w-0" aria-label={labels.usage}>
          <Table className="w-full table-fixed border-collapse text-black!">
            <caption className="sr-only">
              {ORGANIC_EXTRACTION_FORM_TITLE}: {labels.usage}
            </caption>
            <PaperColumns />
            <TableHeader>
              <TableRow className="border-0 hover:bg-white">
                <TableHead rowSpan={2} className={headerCellClass} scope="col">
                  {labels.number}
                </TableHead>
                <TableHead rowSpan={2} className={headerCellClass} scope="col">
                  CODE
                </TableHead>
                <TableHead rowSpan={2} className={headerCellClass} scope="col">
                  {labels.material}
                </TableHead>
                <TableHead rowSpan={2} className={headerCellClass} scope="col">
                  {labels.unit}
                </TableHead>
                <TableHead colSpan={7} className={headerCellClass} scope="colgroup">
                  {labels.roundOne}
                </TableHead>
                <TableHead colSpan={7} className={headerCellClass} scope="colgroup">
                  {labels.roundTwo}
                </TableHead>
              </TableRow>
              <TableRow className="border-0 hover:bg-white">
                <RoundColumnHeaders />
                <RoundColumnHeaders />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.materials.map((material) => {
                const firstUsage = roundOne?.usage_rows.find(
                  (row) => row.row_number === material.row_number,
                );
                const secondUsage = roundTwo?.usage_rows.find(
                  (row) => row.row_number === material.row_number,
                );

                return (
                  <TableRow
                    key={material.row_number}
                    className="border-0 hover:bg-white print:break-inside-avoid"
                  >
                    <TableCell className={`${bodyCellClass} text-center tabular-nums`}>
                      {material.row_number}
                    </TableCell>
                    <TableCell className={bodyCellClass}>
                      {material.material_code}
                    </TableCell>
                    <TableCell className={bodyCellClass}>
                      {material.material_name}
                    </TableCell>
                    <TableCell className={`${bodyCellClass} text-center`}>
                      {material.unit}
                    </TableCell>
                    <MachineValueCells values={firstUsage?.quantities} />
                    <TableCell className={bodyCellClass}>
                      {firstUsage?.remark ?? ""}
                    </TableCell>
                    <MachineValueCells values={secondUsage?.quantities} />
                    <TableCell className={bodyCellClass}>
                      {secondUsage?.remark ?? ""}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>

        <section className="mt-[2mm] min-w-0" aria-label={labels.temperature}>
          <Table className="w-full table-fixed border-collapse text-black!">
            <caption className="sr-only">
              {labels.temperature} (°C) / {labels.ph}
            </caption>
            <PaperColumns />
            <TableHeader>
              <TableRow className="border-0 hover:bg-white">
                <TableHead colSpan={4} className={headerCellClass} scope="colgroup">
                  {labels.temperature} (°C) / {labels.ph}
                </TableHead>
                <TableHead colSpan={7} className={headerCellClass} scope="colgroup">
                  {labels.roundOne}
                </TableHead>
                <TableHead colSpan={7} className={headerCellClass} scope="colgroup">
                  {labels.roundTwo}
                </TableHead>
              </TableRow>
              <TableRow className="border-0 hover:bg-white">
                <TableHead colSpan={4} className={headerCellClass} scope="col">
                  {labels.temperature} / {labels.minute}
                </TableHead>
                <RoundColumnHeaders />
                <RoundColumnHeaders />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORGANIC_EXTRACTION_TEMPERATURE_MINUTES.map((minute) => {
                const first = roundOne?.temperature_rows.find(
                  (row) => row.minute === minute,
                );
                const second = roundTwo?.temperature_rows.find(
                  (row) => row.minute === minute,
                );

                return (
                  <TableRow
                    key={minute}
                    className="border-0 hover:bg-white print:break-inside-avoid"
                  >
                    <TableCell colSpan={4} className={bodyCellClass}>
                      {labels.temperature} {minute} {labels.minute} (°C)
                    </TableCell>
                    <MachineValueCells values={first?.temperatures} />
                    <TableCell className={bodyCellClass}>{first?.remark ?? ""}</TableCell>
                    <MachineValueCells values={second?.temperatures} />
                    <TableCell className={bodyCellClass}>{second?.remark ?? ""}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="border-0 hover:bg-white print:break-inside-avoid">
                <TableCell colSpan={4} className={`${bodyCellClass} font-semibold`}>
                  {labels.ph}
                </TableCell>
                <MachineValueCells values={roundOne?.ph_values} />
                <TableCell className={bodyCellClass}>{roundOne?.ph_remark ?? ""}</TableCell>
                <MachineValueCells values={roundTwo?.ph_values} />
                <TableCell className={bodyCellClass}>{roundTwo?.ph_remark ?? ""}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </section>

        <footer className="mt-auto grid grid-cols-2 gap-[14mm] pt-[5mm] text-[9px]">
          <p className="flex min-w-0 items-end gap-2">
            <span className="shrink-0">{labels.prepared}</span>
            <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 text-center">
              {sheet.prepared_by.trim() || " "}
            </span>
          </p>
          <p className="flex min-w-0 items-end gap-2">
            <span className="shrink-0">{labels.inspected}</span>
            <span className="min-w-0 flex-1 border-b border-dotted border-black px-1 text-center">
              {sheet.inspected_by.trim() || " "}
            </span>
          </p>
        </footer>
      </div>
    </article>
  );
}
