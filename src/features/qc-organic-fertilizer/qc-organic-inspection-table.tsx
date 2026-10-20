"use client";
import { useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/src/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/src/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/src/components/ui/dialog";
import {
  metrics,
  timeSlots,
  metricLabel,
  temperatureCount,
  type OrganicReport,
  type MetricKey,
  type Slot,
  type Errors,
} from "./qc-organic-domain";
export function OrganicInspectionTable({
  row,
  onChange,
  errors = {},
  print = false,
}: {
  row: OrganicReport;
  onChange?: (row: OrganicReport) => void;
  errors?: Errors;
  print?: boolean;
}) {
  const [temperature, setTemperature] = useState<{
    key: MetricKey;
    time: Slot;
    values: string[];
  } | null>(null);
  const [tempError, setTempError] = useState("");
  const readOnly = !onChange;
  const setCell = (key: MetricKey, time: Slot, value: string) =>
    onChange?.({
      ...row,
      measurements: {
        ...row.measurements,
        [key]: { ...row.measurements[key], [time]: value },
      },
    });
  const groups = print
    ? [timeSlots.slice(0, 7), timeSlots.slice(7, 14), timeSlots.slice(14)]
    : [timeSlots];
  return (
    <div className="min-w-0 space-y-4">
      {!print && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          21 ช่วงเวลา · เลื่อนแนวนอนเพื่อดูทุกเวลา · การละลายน้ำใช้ นาที.วินาที
          เช่น 10.30 = 10 นาที 30 วินาที · อุณหภูมิกรอกบางจุดได้ตามต้นฉบับ
          ช่องว่างไม่ใช่ศูนย์ · ไม่ตรวจไม่เท่ากับไม่ผ่าน
        </p>
      )}
      {groups.map((slots, g) => (
        <div
          key={g}
          className="min-w-0 rounded-lg border"
          data-organic-matrix={print ? "print" : "editor"}
        >
          <Table
            className="table-fixed"
            style={
              print
                ? { minWidth: 1000 }
                : {
                    width: 240 + timeSlots.length * 150 + 220,
                    minWidth: 240 + timeSlots.length * 150 + 220,
                  }
            }
          >
            <TableHeader>
              <TableRow>
                <TableHead
                  className={`${!print ? "sticky left-0 z-20 w-60" : "w-[180px]"} bg-muted p-3`}
                >
                  รายการตรวจสอบ / เวลา
                </TableHead>
                {slots.map((t) => (
                  <TableHead
                    key={t}
                    className={`${print ? "w-[90px]" : "w-[150px]"} bg-muted text-center`}
                  >
                    {t}
                  </TableHead>
                ))}
                <TableHead
                  className={`${print ? "w-[160px]" : "w-[220px]"} bg-muted`}
                >
                  หมายเหตุรายหัวข้อ
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map(([key, , kind]) => (
                <TableRow key={key} data-metric={key}>
                  <TableCell
                    className={`${!print ? "sticky left-0 z-10" : ""} bg-background p-3 align-top font-medium whitespace-normal`}
                  >
                    {metricLabel(row.profile, key)}
                  </TableCell>
                  {slots.map((time) => {
                    const value = row.measurements[key][time],
                      id = `cell-${key}-${time}`,
                      error = errors[id],
                      label = `${metricLabel(row.profile, key)} ${time}`;
                    return (
                      <TableCell
                        key={time}
                        className="p-2 align-top whitespace-normal"
                      >
                        <div className="min-w-0 space-y-1">
                          {readOnly ? (
                            <p
                              data-cell={id}
                              className="whitespace-pre-wrap break-words text-center text-sm"
                            >
                              {kind === "boolean"
                                ? value === "true"
                                  ? "ผ่าน"
                                  : value === "false"
                                    ? "ไม่ผ่าน"
                                    : "ไม่ตรวจ"
                                : kind === "temperature"
                                  ? value
                                    ? value
                                        .split("/")
                                        .map(
                                          (v, i) => `จุด ${i + 1}: ${v || "—"}`,
                                        )
                                        .join("\n")
                                    : "ไม่ตรวจ"
                                  : value || "ไม่ตรวจ"}
                            </p>
                          ) : kind === "temperature" ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-auto min-h-9 w-full whitespace-normal break-words text-xs"
                              aria-label={label}
                              aria-invalid={!!error}
                              aria-describedby={
                                error ? `${id}-error` : undefined
                              }
                              onClick={() => {
                                setTemperature({
                                  key,
                                  time,
                                  values: Array.from(
                                    { length: temperatureCount(key) },
                                    (_, i) => value.split("/")[i] ?? "",
                                  ),
                                });
                                setTempError("");
                              }}
                            >
                              {value || `กรอก ${temperatureCount(key)} จุด`}
                            </Button>
                          ) : kind === "boolean" || kind === "dust" ? (
                            <Select
                              value={value || "uninspected"}
                              onValueChange={(v) =>
                                setCell(key, time, v === "uninspected" ? "" : v)
                              }
                            >
                              <SelectTrigger
                                aria-label={label}
                                aria-invalid={!!error}
                                aria-describedby={
                                  error ? `${id}-error` : undefined
                                }
                                className="w-full min-w-0"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="uninspected">
                                  ไม่ตรวจ
                                </SelectItem>
                                {(kind === "boolean"
                                  ? [
                                      ["true", "ผ่าน"],
                                      ["false", "ไม่ผ่าน"],
                                    ]
                                  : row.profile === "itech"
                                    ? [
                                        ["น้อย", "น้อย"],
                                        ["กลาง", "กลาง"],
                                        ["มาก", "มาก"],
                                      ]
                                    : [
                                        ["ฝุ่นปานกลาง", "ฝุ่นปานกลาง"],
                                        ["ฝุ่นเยอะ", "ฝุ่นเยอะ"],
                                        ["ฝุ่นเยอะมาก", "ฝุ่นเยอะมาก"],
                                      ]
                                ).map(([v, label]) => (
                                  <SelectItem key={v} value={v}>
                                    {label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={id}
                              aria-label={label}
                              aria-invalid={!!error}
                              aria-describedby={
                                error ? `${id}-error` : undefined
                              }
                              className="w-full min-w-0"
                              inputMode="decimal"
                              placeholder={
                                kind === "duration"
                                  ? "นาที.วินาที"
                                  : key === "percent_retained_5mm"
                                    ? "ตัวเลข หรือ -"
                                    : "ไม่ตรวจ"
                              }
                              value={value}
                              onChange={(e) =>
                                setCell(key, time, e.target.value)
                              }
                            />
                          )}
                          {error && (
                            <p
                              id={`${id}-error`}
                              className="text-xs text-danger"
                            >
                              {error}
                            </p>
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                  <TableCell className="p-2 align-top whitespace-normal">
                    {readOnly ? (
                      <p className="whitespace-pre-wrap break-words">
                        {row.metricNotes[key] || "—"}
                      </p>
                    ) : (
                      <Textarea
                        aria-label={`หมายเหตุ ${metricLabel(row.profile, key)}`}
                        rows={2}
                        value={row.metricNotes[key]}
                        onChange={(e) =>
                          onChange?.({
                            ...row,
                            metricNotes: {
                              ...row.metricNotes,
                              [key]: e.target.value,
                            },
                          })
                        }
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
      <Dialog
        open={!!temperature}
        onOpenChange={(v) => {
          if (!v) setTemperature(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {temperature
                ? metricLabel(row.profile, temperature.key)
                : "อุณหภูมิ"}
            </DialogTitle>
            <DialogDescription>
              {temperature?.time} · กรอกแต่ละจุดแยกกัน ช่องว่างยังไม่ตรวจ
              ไม่แปลงเป็นศูนย์
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-flow-col grid-rows-2 gap-4">
            {temperature?.values.map((v, i) => (
              <div key={i} className="min-w-0 space-y-2">
                <Label htmlFor={`organic-temp-${i}`}>จุดที่ {i + 1}</Label>
                <Input
                  id={`organic-temp-${i}`}
                  inputMode="decimal"
                  value={v}
                  onChange={(e) =>
                    setTemperature((prev) =>
                      prev
                        ? {
                            ...prev,
                            values: prev.values.map((x, j) =>
                              j === i ? e.target.value : x,
                            ),
                          }
                        : null,
                    )
                  }
                />
              </div>
            ))}
          </div>
          {tempError && (
            <p role="alert" className="text-sm text-danger">
              {tempError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTemperature(null)}
            >
              ยกเลิก
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!temperature) return;
                if (
                  temperature.values.some(
                    (v) => v.trim() !== "" && !Number.isFinite(Number(v)),
                  )
                ) {
                  setTempError("กรุณากรอกอุณหภูมิเป็นตัวเลขหรือเว้นว่าง");
                  return;
                }
                setCell(
                  temperature.key,
                  temperature.time,
                  temperature.values.every((v) => !v.trim())
                    ? ""
                    : temperature.values.map((v) => v.trim()).join("/"),
                );
                setTemperature(null);
              }}
            >
              เก็บค่าอุณหภูมิ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
