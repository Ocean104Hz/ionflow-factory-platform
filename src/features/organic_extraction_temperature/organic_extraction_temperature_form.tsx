"use client";

import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
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
import { SectionCard } from "@/src/components/factory/patterns";

import {
  ORGANIC_EXTRACTION_FORM_TITLE,
  ORGANIC_EXTRACTION_MACHINES,
  ORGANIC_EXTRACTION_MATERIAL_COUNT,
  ORGANIC_EXTRACTION_TEMPERATURE_MINUTES,
  hasOrganicExtractionRoundData,
  type OrganicExtractionErrors,
  type OrganicExtractionMachine,
  type OrganicExtractionProductionRound,
  type OrganicExtractionRoundNumber,
  type OrganicExtractionTemperatureMinute,
  type OrganicExtractionTemperatureSheet,
} from "./organic_extraction_temperature_domain";

type Props = {
  sheet: OrganicExtractionTemperatureSheet;
  errors: OrganicExtractionErrors;
  onChange: (sheet: OrganicExtractionTemperatureSheet) => void;
  onSave: () => void;
  onReset: () => void;
};

type MaterialField = "material_code" | "material_name" | "unit";
type RoundTextField = "production_name" | "start_time" | "end_time";

type TextInputCellProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
};

type DecimalCellProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const labels = {
  documentDate: "วันที่เอกสาร",
  sharedMaterials: "รายการวัตถุดิบใช้ร่วมกันทั้งสองรอบ",
  roundOne: "รอบที่ 1 (ฝั่งซ้าย)",
  roundTwo: "รอบที่ 2 (ฝั่งขวา)",
  production: "รายการผลิต",
  startTime: "เวลาเริ่ม",
  endTime: "เวลาสิ้นสุด",
  number: "ลำดับ",
  code: "รหัสวัตถุดิบ",
  material: "ชื่อวัตถุดิบ",
  unit: "หน่วย",
  quantity: "ปริมาณการใช้วัตถุดิบ",
  remark: "หมายเหตุ",
  temperature: "บันทึกอุณหภูมิ (°C) และค่า pH",
  measuredTemperature: "อุณหภูมิที่วัดได้ (°C)",
  productionStage: "ช่วงที่",
  elapsedMinute: "นาทีที่",
  machineGroup: "เครื่องผลิต",
  preparedBy: "ผู้จัดทำ",
  inspectedBy: "ผู้ตรวจสอบ",
  save: "บันทึกข้อมูล",
  saveEdit: "บันทึกการแก้ไข",
  reset: "ล้างข้อมูล",
  cancel: "ยกเลิกการแก้ไข / เริ่มใหม่",
  mock: "ข้อมูลจะบันทึกเมื่อกดบันทึกเอกสาร",
} as const;

const tableHeadClass =
  "border border-border bg-muted/40 px-2 py-3 text-center " +
  "align-middle text-xs font-semibold text-foreground whitespace-normal";
const tableCellClass = "border border-border p-2 align-middle";
const cellInputClass = "h-9 w-full min-w-0 border-border bg-surface text-sm";
const decimalInputClass =
  "h-9 w-full min-w-0 border-border bg-surface " +
  "text-right text-sm tabular-nums";
const remarkClass =
  "min-h-9 w-full min-w-0 resize-y border-border bg-surface text-sm";

const roundNumbers: readonly OrganicExtractionRoundNumber[] = [1, 2];

function TextInputCell({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
}: TextInputCellProps) {
  return (
    <div className="min-w-0 space-y-1">
      <Input
        id={id}
        type="text"
        autoComplete="off"
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder={placeholder}
        className={cellInputClass}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function DecimalCell({ id, label, value, onChange, error }: DecimalCellProps) {
  return (
    <div className="min-w-0 space-y-1">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        placeholder="-"
        className={decimalInputClass}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function OrganicExtractionTemperatureForm({
  sheet,
  errors,
  onChange,
  onSave,
  onReset,
}: Props) {
  const [activeRound, setActiveRound] =
    useState<OrganicExtractionRoundNumber>(1);

  function updateMaterial(
    rowNumber: number,
    field: MaterialField,
    value: string,
  ) {
    onChange({
      ...sheet,
      materials: sheet.materials.map((material) =>
        material.row_number === rowNumber
          ? { ...material, [field]: value }
          : material,
      ),
    });
  }

  function updateRound(
    roundNumber: OrganicExtractionRoundNumber,
    updater: (
      round: OrganicExtractionProductionRound,
    ) => OrganicExtractionProductionRound,
  ) {
    onChange({
      ...sheet,
      rounds: sheet.rounds.map((round) =>
        round.round_number === roundNumber ? updater(round) : round,
      ),
    });
  }

  function updateRoundText(
    roundNumber: OrganicExtractionRoundNumber,
    field: RoundTextField,
    value: string,
  ) {
    updateRound(roundNumber, (round) => ({ ...round, [field]: value }));
  }

  function updateUsage(
    roundNumber: OrganicExtractionRoundNumber,
    rowNumber: number,
    machine: OrganicExtractionMachine,
    value: string,
  ) {
    updateRound(roundNumber, (round) => ({
      ...round,
      usage_rows: round.usage_rows.map((row) =>
        row.row_number === rowNumber
          ? {
              ...row,
              quantities: { ...row.quantities, [machine]: value },
            }
          : row,
      ),
    }));
  }

  function updateUsageRemark(
    roundNumber: OrganicExtractionRoundNumber,
    rowNumber: number,
    value: string,
  ) {
    updateRound(roundNumber, (round) => ({
      ...round,
      usage_rows: round.usage_rows.map((row) =>
        row.row_number === rowNumber ? { ...row, remark: value } : row,
      ),
    }));
  }

  function updateTemperature(
    roundNumber: OrganicExtractionRoundNumber,
    minute: OrganicExtractionTemperatureMinute,
    machine: OrganicExtractionMachine,
    value: string,
  ) {
    updateRound(roundNumber, (round) => ({
      ...round,
      temperature_rows: round.temperature_rows.map((row) =>
        row.minute === minute
          ? {
              ...row,
              temperatures: { ...row.temperatures, [machine]: value },
            }
          : row,
      ),
    }));
  }

  function updateTemperatureRemark(
    roundNumber: OrganicExtractionRoundNumber,
    minute: OrganicExtractionTemperatureMinute,
    value: string,
  ) {
    updateRound(roundNumber, (round) => ({
      ...round,
      temperature_rows: round.temperature_rows.map((row) =>
        row.minute === minute ? { ...row, remark: value } : row,
      ),
    }));
  }

  function updatePh(
    roundNumber: OrganicExtractionRoundNumber,
    machine: OrganicExtractionMachine,
    value: string,
  ) {
    updateRound(roundNumber, (round) => ({
      ...round,
      ph_values: { ...round.ph_values, [machine]: value },
    }));
  }

  const hasMaterialErrors = Object.keys(errors).some((key) =>
    key.startsWith("materials."),
  );

  return (
    <form
      noValidate
      className="min-w-0 space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <SectionCard title={ORGANIC_EXTRACTION_FORM_TITLE}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label
                htmlFor="organic-extraction-document-date"
                className="block text-sm font-medium leading-5"
              >
                {labels.documentDate} <span className="text-danger">*</span>
              </label>
              <Input
                id="organic-extraction-document-date"
                type="date"
                value={sheet.document_date}
                aria-invalid={Boolean(errors.document_date)}
                aria-describedby={
                  errors.document_date
                    ? "organic-extraction-document-date-error"
                    : undefined
                }
                onChange={(event) =>
                  onChange({
                    ...sheet,
                    document_date: event.currentTarget.value,
                  })
                }
                className="h-9 w-full border-border bg-surface"
              />
              {errors.document_date && (
                <p
                  id="organic-extraction-document-date-error"
                  role="alert"
                  className="text-xs text-danger"
                >
                  {errors.document_date}
                </p>
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <p className="block text-sm font-medium leading-5">
                รูปแบบการบันทึก
              </p>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-sm font-medium">
                1 เอกสาร / 2 รอบการผลิต
              </div>
            </div>
          </div>
          {errors.materials && (
            <p role="alert" className="text-sm text-danger">
              {errors.materials}
            </p>
          )}
          {errors.rounds && (
            <p role="alert" className="text-sm text-danger">
              {errors.rounds}
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="บันทึกข้อมูลรอบการผลิต">
        <Tabs
          value={String(activeRound)}
          onValueChange={(value) => setActiveRound(value === "2" ? 2 : 1)}
          className="min-w-0 space-y-4"
        >
          <div className="min-w-0 overflow-x-auto">
            <TabsList aria-label="เลือกรอบการผลิต">
              {roundNumbers.map((roundNumber) => {
                const round = sheet.rounds.find(
                  (item) => item.round_number === roundNumber,
                );
                const errorCount = Object.keys(errors).filter((key) =>
                  key.startsWith(`rounds.${roundNumber - 1}.`),
                ).length;

                return (
                  <TabsTrigger key={roundNumber} value={String(roundNumber)}>
                    {roundNumber === 1 ? labels.roundOne : labels.roundTwo}
                    {round && hasOrganicExtractionRoundData(round)
                      ? " · มีข้อมูล"
                      : " · ยังไม่กรอก"}
                    {errorCount > 0 ? ` (${errorCount} จุดต้องตรวจสอบ)` : ""}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {roundNumbers.map((roundNumber) => {
            const round = sheet.rounds.find(
              (item) => item.round_number === roundNumber,
            );
            const roundIndex = roundNumber - 1;
            const roundLabel =
              roundNumber === 1 ? labels.roundOne : labels.roundTwo;

            return (
              <TabsContent
                key={roundNumber}
                value={String(roundNumber)}
                className="mt-0 min-w-0 space-y-5"
              >
                {!round ? (
                  <p role="alert" className="text-sm text-danger">
                    ไม่พบข้อมูลรอบการผลิตที่ {roundNumber}
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-3">
                      <div className="min-w-0 space-y-2">
                        <label
                          htmlFor={`extraction-round-${roundNumber}-production-name`}
                          className="block text-sm font-medium"
                        >
                          {labels.production} ({roundLabel})
                        </label>
                        <Input
                          id={`extraction-round-${roundNumber}-production-name`}
                          value={round.production_name}
                          onChange={(event) =>
                            updateRoundText(
                              roundNumber,
                              "production_name",
                              event.currentTarget.value,
                            )
                          }
                          className={cellInputClass}
                          placeholder="ระบุรายการผลิต"
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <label
                          htmlFor={`extraction-round-${roundNumber}-start-time`}
                          className="block text-sm font-medium"
                        >
                          {labels.startTime}
                        </label>
                        <Input
                          id={`extraction-round-${roundNumber}-start-time`}
                          type="time"
                          value={round.start_time}
                          onChange={(event) =>
                            updateRoundText(
                              roundNumber,
                              "start_time",
                              event.currentTarget.value,
                            )
                          }
                          className={cellInputClass}
                        />
                      </div>
                      <div className="min-w-0 space-y-2">
                        <label
                          htmlFor={`extraction-round-${roundNumber}-end-time`}
                          className="block text-sm font-medium"
                        >
                          {labels.endTime}
                        </label>
                        <Input
                          id={`extraction-round-${roundNumber}-end-time`}
                          type="time"
                          value={round.end_time}
                          onChange={(event) =>
                            updateRoundText(
                              roundNumber,
                              "end_time",
                              event.currentTarget.value,
                            )
                          }
                          className={cellInputClass}
                        />
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-foreground">
                            {labels.quantity} ({roundLabel})
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {ORGANIC_EXTRACTION_MATERIAL_COUNT} รายการ, เครื่อง
                            B1-B6
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          เลื่อนตารางแนวนอนเพื่อกรอกข้อมูลเมื่อหน้าจอแคบ
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {labels.sharedMaterials}: การแก้รหัส ชื่อ
                        หรือหน่วยที่นี่ จะมีผลกับทั้งสองรอบ
                        แต่ปริมาณและหมายเหตุแยกตามรอบ
                      </p>
                      {hasMaterialErrors && (
                        <p role="alert" className="text-xs text-danger">
                          กรุณาตรวจสอบรหัสวัตถุดิบในตาราง
                        </p>
                      )}
                      {errors[`rounds.${roundIndex}.usage_rows`] && (
                        <p role="alert" className="text-xs text-danger">
                          {errors[`rounds.${roundIndex}.usage_rows`]}
                        </p>
                      )}

                      <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
                        <Table className="w-full min-w-[1680px] table-fixed border-collapse text-sm">
                          <colgroup>
                            <col className="w-14" />
                            <col className="w-36" />
                            <col className="w-56" />
                            <col className="w-20" />
                            {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                              <col key={machine} className="w-34" />
                            ))}
                            <col className="w-50" />
                          </colgroup>
                          <TableHeader>
                            <TableRow>
                              <TableHead rowSpan={2} className={tableHeadClass}>
                                {labels.number}
                              </TableHead>
                              <TableHead rowSpan={2} className={tableHeadClass}>
                                {labels.code}
                              </TableHead>
                              <TableHead rowSpan={2} className={tableHeadClass}>
                                {labels.material}
                              </TableHead>
                              <TableHead rowSpan={2} className={tableHeadClass}>
                                {labels.unit}
                              </TableHead>
                              <TableHead colSpan={6} className={tableHeadClass}>
                                {labels.quantity}
                              </TableHead>
                              <TableHead rowSpan={2} className={tableHeadClass}>
                                {labels.remark}
                              </TableHead>
                            </TableRow>
                            <TableRow>
                              {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                                <TableHead
                                  key={machine}
                                  className={tableHeadClass}
                                >
                                  {machine}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {Array.from(
                              { length: ORGANIC_EXTRACTION_MATERIAL_COUNT },
                              (_, index) => {
                                const rowNumber = index + 1;
                                const material = sheet.materials[index];
                                const usageRow = round.usage_rows[index];

                                if (
                                  !material ||
                                  material.row_number !== rowNumber ||
                                  !usageRow ||
                                  usageRow.row_number !== rowNumber
                                ) {
                                  return (
                                    <TableRow key={rowNumber}>
                                      <TableCell
                                        colSpan={11}
                                        className={tableCellClass}
                                      >
                                        <p role="alert" className="text-danger">
                                          ไม่พบข้อมูลรายการวัตถุดิบลำดับที่{" "}
                                          {rowNumber}
                                        </p>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                return (
                                  <TableRow
                                    key={rowNumber}
                                    className="align-middle"
                                  >
                                    <TableCell
                                      className={`${tableCellClass} text-center tabular-nums`}
                                    >
                                      {rowNumber}
                                    </TableCell>
                                    <TableCell className={tableCellClass}>
                                      <TextInputCell
                                        id={`extraction-material-${rowNumber}-code`}
                                        label={`แถวที่ ${rowNumber}: ${labels.code}`}
                                        value={material.material_code}
                                        error={
                                          errors[
                                            `materials.${index}.material_code`
                                          ]
                                        }
                                        onChange={(value) =>
                                          updateMaterial(
                                            rowNumber,
                                            "material_code",
                                            value,
                                          )
                                        }
                                      />
                                    </TableCell>
                                    <TableCell className={tableCellClass}>
                                      <TextInputCell
                                        id={`extraction-material-${rowNumber}-name`}
                                        label={`แถวที่ ${rowNumber}: ${labels.material}`}
                                        value={material.material_name}
                                        onChange={(value) =>
                                          updateMaterial(
                                            rowNumber,
                                            "material_name",
                                            value,
                                          )
                                        }
                                        placeholder="ระบุชื่อวัตถุดิบ"
                                      />
                                    </TableCell>
                                    <TableCell className={tableCellClass}>
                                      <TextInputCell
                                        id={`extraction-material-${rowNumber}-unit`}
                                        label={`แถวที่ ${rowNumber}: ${labels.unit}`}
                                        value={material.unit}
                                        onChange={(value) =>
                                          updateMaterial(
                                            rowNumber,
                                            "unit",
                                            value,
                                          )
                                        }
                                      />
                                    </TableCell>
                                    {ORGANIC_EXTRACTION_MACHINES.map(
                                      (machine) => (
                                        <TableCell
                                          key={machine}
                                          className={tableCellClass}
                                        >
                                          <DecimalCell
                                            id={`extraction-round-${roundNumber}-usage-${rowNumber}-${machine}`}
                                            label={`${roundLabel}: ${material.material_code} ${machine} ปริมาณ${material.unit}`}
                                            value={usageRow.quantities[machine]}
                                            error={
                                              errors[
                                                `rounds.${roundIndex}.usage_rows.${index}.quantities.${machine}`
                                              ]
                                            }
                                            onChange={(value) =>
                                              updateUsage(
                                                roundNumber,
                                                rowNumber,
                                                machine,
                                                value,
                                              )
                                            }
                                          />
                                        </TableCell>
                                      ),
                                    )}
                                    <TableCell className={tableCellClass}>
                                      <Textarea
                                        id={`extraction-round-${roundNumber}-usage-${rowNumber}-remark`}
                                        aria-label={`${roundLabel}: ${material.material_code} ${labels.remark}`}
                                        value={usageRow.remark}
                                        onChange={(event) =>
                                          updateUsageRemark(
                                            roundNumber,
                                            rowNumber,
                                            event.currentTarget.value,
                                          )
                                        }
                                        rows={2}
                                        className={remarkClass}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              },
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-3">
                      <div className="space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">
                          {labels.temperature} ({roundLabel})
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          วัดอุณหภูมิที่นาที 90, 120, 150 และ 180 โดยแยกเครื่อง
                          B1-B6 และบันทึก pH แยกอีกหนึ่งแถว
                        </p>
                      </div>
                      {errors[`rounds.${roundIndex}.temperature_rows`] && (
                        <p role="alert" className="text-xs text-danger">
                          {errors[`rounds.${roundIndex}.temperature_rows`]}
                        </p>
                      )}
                      <div className="w-full min-w-0 overflow-x-auto rounded-lg border border-border">
                        <Table className="w-full min-w-330 table-fixed border-collapse text-sm">
                          <colgroup>
                            <col className="w-28" />
                            <col className="w-28" />
                            {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                              <col key={machine} className="w-36" />
                            ))}
                            <col className="w-56" />
                          </colgroup>
                          <TableHeader>
                            <TableRow>
                              <TableHead colSpan={2} className={tableHeadClass}>
                                {labels.measuredTemperature}
                              </TableHead>
                              <TableHead colSpan={6} className={tableHeadClass}>
                                {labels.machineGroup}
                              </TableHead>
                              <TableHead rowSpan={2} className={tableHeadClass}>
                                {labels.remark}
                              </TableHead>
                            </TableRow>
                            <TableRow>
                              <TableHead className={tableHeadClass}>
                                {labels.productionStage}
                              </TableHead>
                              <TableHead className={tableHeadClass}>
                                {labels.elapsedMinute}
                              </TableHead>
                              {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                                <TableHead
                                  key={machine}
                                  className={tableHeadClass}
                                >
                                  {machine}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ORGANIC_EXTRACTION_TEMPERATURE_MINUTES.map(
                              (minute, minuteIndex) => {
                                const tempRow = round.temperature_rows.find(
                                  (row) => row.minute === minute,
                                );

                                if (!tempRow) {
                                  return (
                                    <TableRow key={minute}>
                                      <TableCell
                                        colSpan={9}
                                        className={tableCellClass}
                                      >
                                        <p role="alert" className="text-danger">
                                          ไม่พบช่วงวัดอุณหภูมินาทีที่ {minute}
                                        </p>
                                      </TableCell>
                                    </TableRow>
                                  );
                                }

                                return (
                                  <TableRow key={minute}>
                                    <TableCell
                                      className={`${tableCellClass} text-center font-semibold`}
                                    >
                                      ช่วงที่ {minuteIndex + 1}
                                    </TableCell>
                                    <TableCell
                                      className={`${tableCellClass} text-center font-medium tabular-nums`}
                                    >
                                      นาทีที่ {minute}
                                    </TableCell>
                                    {ORGANIC_EXTRACTION_MACHINES.map(
                                      (machine) => (
                                        <TableCell
                                          key={machine}
                                          className={tableCellClass}
                                        >
                                          <DecimalCell
                                            id={`extraction-round-${roundNumber}-temp-${minute}-${machine}`}
                                            label={`${roundLabel}: ${machine} อุณหภูมิ นาทีที่ ${minute} องศาเซลเซียส`}
                                            value={
                                              tempRow.temperatures[machine]
                                            }
                                            error={
                                              errors[
                                                `rounds.${roundIndex}.temperature_rows.${minuteIndex}.temperatures.${machine}`
                                              ]
                                            }
                                            onChange={(value) =>
                                              updateTemperature(
                                                roundNumber,
                                                minute,
                                                machine,
                                                value,
                                              )
                                            }
                                          />
                                        </TableCell>
                                      ),
                                    )}
                                    <TableCell className={tableCellClass}>
                                      <Textarea
                                        id={`extraction-round-${roundNumber}-temp-${minute}-remark`}
                                        aria-label={`${roundLabel}: นาทีที่ ${minute} ${labels.remark}`}
                                        value={tempRow.remark}
                                        onChange={(event) =>
                                          updateTemperatureRemark(
                                            roundNumber,
                                            minute,
                                            event.currentTarget.value,
                                          )
                                        }
                                        rows={2}
                                        className={remarkClass}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              },
                            )}
                            <TableRow>
                              <TableCell
                                colSpan={2}
                                className={`${tableCellClass} text-center font-semibold`}
                              >
                                ค่า pH
                              </TableCell>
                              {ORGANIC_EXTRACTION_MACHINES.map((machine) => (
                                <TableCell
                                  key={machine}
                                  className={tableCellClass}
                                >
                                  <DecimalCell
                                    id={`extraction-round-${roundNumber}-ph-${machine}`}
                                    label={`${roundLabel}: ค่า pH เครื่อง ${machine}`}
                                    value={round.ph_values[machine]}
                                    error={
                                      errors[
                                        `rounds.${roundIndex}.ph_values.${machine}`
                                      ]
                                    }
                                    onChange={(value) =>
                                      updatePh(roundNumber, machine, value)
                                    }
                                  />
                                </TableCell>
                              ))}
                              <TableCell className={tableCellClass}>
                                <Textarea
                                  id={`extraction-round-${roundNumber}-ph-remark`}
                                  aria-label={`${roundLabel}: หมายเหตุค่า pH`}
                                  value={round.ph_remark}
                                  onChange={(event) =>
                                    updateRound(roundNumber, (current) => ({
                                      ...current,
                                      ph_remark: event.currentTarget.value,
                                    }))
                                  }
                                  rows={2}
                                  className={remarkClass}
                                />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ช่องตัวเลขสามารถเว้นว่างได้จนกว่าจะยืนยันเงื่อนไขบังคับกรอกของโรงงาน
                      </p>
                    </div>
                  </>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </SectionCard>

      <SectionCard title={`${labels.preparedBy} / ${labels.inspectedBy}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="extraction-prepared-by"
              className="block text-sm font-medium"
            >
              {labels.preparedBy}
            </label>
            <Input
              id="extraction-prepared-by"
              value={sheet.prepared_by}
              onChange={(event) =>
                onChange({ ...sheet, prepared_by: event.currentTarget.value })
              }
              className={cellInputClass}
              placeholder="ชื่อผู้จัดทำ"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="extraction-inspected-by"
              className="block text-sm font-medium"
            >
              {labels.inspectedBy}
            </label>
            <Input
              id="extraction-inspected-by"
              value={sheet.inspected_by}
              onChange={(event) =>
                onChange({ ...sheet, inspected_by: event.currentTarget.value })
              }
              className={cellInputClass}
              placeholder="ชื่อผู้ตรวจสอบ"
            />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button type="button" variant="outline" onClick={onReset}>
          {sheet.id ? labels.cancel : labels.reset}
        </Button>
        <Button type="submit">
          {sheet.id ? labels.saveEdit : labels.save}
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">{labels.mock}</p>
    </form>
  );
}
