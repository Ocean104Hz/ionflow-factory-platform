"use client";

import { Pencil, Printer, X } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/src/components/ui/tabs";

import {
  ORGANIC_EXTRACTION_FORM_TITLE,
  ORGANIC_EXTRACTION_MACHINES,
  ORGANIC_EXTRACTION_MATERIAL_COUNT,
  ORGANIC_EXTRACTION_TEMPERATURE_MINUTES,
  formatOrganicExtractionDate,
  formatOrganicExtractionDateTime,
  hasOrganicExtractionRoundData,
  type OrganicExtractionProductionRound,
  type OrganicExtractionRoundNumber,
  type OrganicExtractionTemperatureSheet,
} from "./organic_extraction_temperature_domain";
import { OrganicExtractionTemperaturePaper } from "./organic_extraction_temperature_paper";

type Props = {
  sheet: OrganicExtractionTemperatureSheet | null;
  print: boolean;
  onClose: () => void;
  onEdit: (sheet: OrganicExtractionTemperatureSheet) => void;
  onPrint: (sheet: OrganicExtractionTemperatureSheet) => void;
};

const roundNumbers: readonly OrganicExtractionRoundNumber[] = [1, 2];

const headerClass =
  "border border-border bg-muted/40 px-3 py-3 " +
  "text-center align-middle text-xs font-semibold text-foreground whitespace-normal";
const cellClass = "border border-border p-2 align-middle text-sm";

function displayText(value: string): string {
  return value.trim() || "-";
}

function displayNumber(value: string): string {
  const raw = value.trim();
  if (!raw) {
    return "-";
  }

  const normalized = raw.replaceAll(",", "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return raw;
  }

  const [integerPart, fractionalPart] = normalized.split(".");
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fractionalPart === undefined ? grouped : `${grouped}.${fractionalPart}`;
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 wrap-break-word text-sm font-medium text-foreground">
        {displayText(value)}
      </dd>
    </div>
  );
}

function RoundDetails({
  round,
  sheet,
}: {
  round: OrganicExtractionProductionRound;
  sheet: OrganicExtractionTemperatureSheet;
}) {
  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            ข้อมูลการผลิต รอบที่ {round.round_number}
          </h3>
          <span className="text-xs text-muted-foreground">
            {hasOrganicExtractionRoundData(round)
              ? "มีข้อมูลการผลิต"
              : "ยังไม่ได้กรอกข้อมูลรอบนี้"}
          </span>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <DetailField label="รายการผลิต" value={round.production_name} />
          <DetailField label="เวลาเริ่มผลิต" value={round.start_time} />
          <DetailField label="เวลาสิ้นสุด" value={round.end_time} />
        </dl>
      </section>

      <section className="min-w-0 rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            การใช้วัตถุดิบ รอบที่ {round.round_number}
          </h3>
          <span className="text-xs text-muted-foreground">
            {sheet.materials.length} รายการ / เครื่องผลิต B1–B6
          </span>
        </div>
        <div className="max-w-full overflow-x-auto rounded-lg border border-border">
          <Table className="w-full min-w-270 table-fixed border-collapse">
            <caption className="sr-only">
              รายการใช้วัตถุดิบ {ORGANIC_EXTRACTION_MATERIAL_COUNT} แถว
              รอบที่ {round.round_number}
            </caption>
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[11%]" />
              <col className="w-[21%]" />
              <col className="w-[7%]" />
              {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                <col key={machine} className="w-[7%]" />
              ))}
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2} className={headerClass}>
                  ลำดับ
                </TableHead>
                <TableHead rowSpan={2} className={headerClass}>
                  รหัสวัตถุดิบ
                </TableHead>
                <TableHead rowSpan={2} className={headerClass}>
                  ชื่อวัตถุดิบ
                </TableHead>
                <TableHead rowSpan={2} className={headerClass}>
                  หน่วย
                </TableHead>
                <TableHead colSpan={6} className={headerClass}>
                  เครื่องผลิต / ปริมาณการใช้
                </TableHead>
                <TableHead rowSpan={2} className={headerClass}>
                  หมายเหตุ
                </TableHead>
              </TableRow>
              <TableRow>
                {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                  <TableHead key={machine} className={headerClass}>
                    {machine}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sheet.materials.map((material) => {
                const usageRow = round.usage_rows.find(
                  (entry) => entry.row_number === material.row_number,
                );

                return (
                  <TableRow key={material.row_number}>
                    <TableCell className={`${cellClass} text-center tabular-nums`}>
                      {material.row_number}
                    </TableCell>
                    <TableCell className={`${cellClass} wrap-break-word font-medium`}>
                      {displayText(material.material_code)}
                    </TableCell>
                    <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                      {displayText(material.material_name)}
                    </TableCell>
                    <TableCell className={`${cellClass} text-center`}>
                      {displayText(material.unit)}
                    </TableCell>
                    {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                      <TableCell
                        key={machine}
                        className={`${cellClass} text-right tabular-nums`}
                      >
                        {displayNumber(usageRow?.quantities[machine] ?? "")}
                      </TableCell>
                    ))}
                    <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                      {displayText(usageRow?.remark ?? "")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">
          อุณหภูมิและค่า pH รอบที่ {round.round_number}
        </h3>
        <div className="max-w-full overflow-x-auto rounded-lg border border-border">
          <Table className="w-full min-w-205 table-fixed border-collapse">
            <caption className="sr-only">
              บันทึกอุณหภูมิที่นาที 90, 120, 150, 180 และค่า pH
              รอบที่ {round.round_number}
            </caption>
            <colgroup>
              <col className="w-[18%]" />
              {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                <col key={machine} className="w-[10%]" />
              ))}
              <col className="w-[22%]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className={headerClass}>ช่วงเวลาวัด</TableHead>
                {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                  <TableHead key={machine} className={headerClass}>
                    {machine}
                  </TableHead>
                ))}
                <TableHead className={headerClass}>หมายเหตุ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORGANIC_EXTRACTION_TEMPERATURE_MINUTES.map((minute) => {
                const temperatureRow = round.temperature_rows.find(
                  (entry) => entry.minute === minute,
                );

                return (
                  <TableRow key={minute}>
                    <TableCell className={`${cellClass} font-medium tabular-nums`}>
                      {minute} นาที (°C)
                    </TableCell>
                    {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                      <TableCell
                        key={machine}
                        className={`${cellClass} text-right tabular-nums`}
                      >
                        {displayNumber(temperatureRow?.temperatures[machine] ?? "")}
                      </TableCell>
                    ))}
                    <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                      {displayText(temperatureRow?.remark ?? "")}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell className={`${cellClass} font-semibold`}>ค่า pH</TableCell>
                {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                  <TableCell
                    key={machine}
                    className={`${cellClass} text-right font-medium tabular-nums`}
                  >
                    {displayNumber(round.ph_values[machine])}
                  </TableCell>
                ))}
                <TableCell className={`${cellClass} whitespace-pre-wrap wrap-break-word`}>
                  {displayText(round.ph_remark)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

export function OrganicExtractionTemperatureDetail({
  sheet,
  print,
  onClose,
  onEdit,
  onPrint,
}: Props) {
  return (
    <Dialog
      open={sheet !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent variant={print ? "preview" : "default"} className="flex max-h-[94dvh] w-[96vw] max-w-none flex-col gap-4 overflow-hidden p-4 sm:max-w-350 sm:p-6">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle>
            {print
              ? "พรีวิวใบบันทึกการใช้วัตถุสกัด/อุณหภูมิในการผลิต"
              : "รายละเอียดใบบันทึกการใช้วัตถุสกัด/อุณหภูมิในการผลิต"}
          </DialogTitle>
          <DialogDescription>
            {print
              ? "ตัวอย่างรูปแบบเอกสารก่อนพิมพ์"
              : "แสดงข้อมูลแบบอ่านอย่างเดียว"}
            {" · เอกสารชุดอินทรีย์"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-3">
          {sheet &&
            (print ? (
              <div className="min-w-max">
                <OrganicExtractionTemperaturePaper sheet={sheet} />
              </div>
            ) : (
              <div className="min-w-0 space-y-5">
                <section className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h2 className="min-w-0 text-base font-semibold text-foreground">
                      {ORGANIC_EXTRACTION_FORM_TITLE}
                    </h2>
                    <span className="text-sm font-medium text-foreground">
                      วันที่เอกสาร: {formatOrganicExtractionDate(sheet.document_date) || "-"}
                    </span>
                  </div>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <DetailField label="รหัสเอกสารภายใน" value={sheet.id} />
                    <DetailField label="ผู้จัดทำ" value={sheet.prepared_by} />
                    <DetailField label="ผู้ตรวจสอบ" value={sheet.inspected_by} />
                    <DetailField
                      label="วันที่บันทึก"
                      value={formatOrganicExtractionDateTime(sheet.created_at)}
                    />
                    <DetailField
                      label="อัปเดตล่าสุด"
                      value={formatOrganicExtractionDateTime(sheet.updated_at)}
                    />
                    <DetailField
                      label="จำนวนรายการวัตถุดิบ"
                      value={String(sheet.materials.length)}
                    />
                  </dl>
                  <p className="mt-4 text-xs text-muted-foreground">
                    เอกสารนี้มี 2 รอบการผลิต ใช้รายการวัตถุดิบชุดเดียวกัน
                    แต่บันทึกปริมาณ อุณหภูมิ และ pH แยกกัน
                  </p>
                </section>

                <Tabs key={sheet.id} defaultValue="1" className="min-w-0 space-y-4">
                  <div className="max-w-full overflow-x-auto">
                    <TabsList aria-label="เลือกรอบการผลิตที่ต้องการดู">
                      {roundNumbers.map((roundNumber) => {
                        const round = sheet.rounds.find(
                          (entry) => entry.round_number === roundNumber,
                        );

                        return (
                          <TabsTrigger key={roundNumber} value={String(roundNumber)}>
                            รอบที่ {roundNumber}
                            {round && hasOrganicExtractionRoundData(round)
                              ? " · มีข้อมูล"
                              : " · ยังไม่กรอก"}
                          </TabsTrigger>
                        );
                      })}
                    </TabsList>
                  </div>

                  {roundNumbers.map((roundNumber) => {
                    const round = sheet.rounds.find(
                      (entry) => entry.round_number === roundNumber,
                    );

                    return (
                      <TabsContent
                        key={roundNumber}
                        value={String(roundNumber)}
                        className="mt-0 min-w-0"
                      >
                        {round ? (
                          <RoundDetails round={round} sheet={sheet} />
                        ) : (
                          <p role="alert" className="text-sm text-danger">
                            ไม่พบข้อมูลรอบการผลิตที่ {roundNumber}
                          </p>
                        )}
                      </TabsContent>
                    );
                  })}
                </Tabs>
              </div>
            ))}
        </div>

        <DialogFooter className="shrink-0 gap-2">
          {sheet && (
            <>
              <Button type="button" variant="outline" onClick={() => onEdit(sheet)}>
                <Pencil className="size-4" aria-hidden="true" />
                แก้ไข
              </Button>
              {!print && (
                <Button type="button" onClick={() => onPrint(sheet)}>
                  <Printer className="size-4" aria-hidden="true" />
                  พรีวิวก่อนพิมพ์
                </Button>
              )}
            </>
          )}
          <DialogClose asChild>
            <Button type="button" variant="outline">
              <X className="size-4" aria-hidden="true" />
              ปิด
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
