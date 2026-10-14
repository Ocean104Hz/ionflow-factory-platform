"use client";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/src/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/src/components/ui/popover";
import {
  periodRange,
  validRange,
  type DateRange,
  type DashboardPeriod,
} from "@/src/lib/mock-data/dashboard";
const periods = [
  ["today", "วันนี้"],
  ["week", "7 วัน"],
  ["month", "เดือนนี้"],
  ["year", "ปีนี้"],
  ["custom", "กำหนดเอง"],
] as const;
export function PeriodFilter({
  period,
  range,
  anchor,
  onChange,
}: {
  period: DashboardPeriod;
  range: DateRange;
  anchor: string;
  onChange: (period: DashboardPeriod, range: DateRange) => void;
}) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState("");
  function choose(value: string) {
    const option = periods.find(([key]) => key === value);
    if (!option) return;
    setError("");
    if (option[0] === "custom") {
      setDraft(range);
      setCustom(true);
    } else {
      setCustom(false);
      onChange(option[0], periodRange(option[0], anchor));
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={period} onValueChange={choose} className="hidden md:block">
        <TabsList className="h-9">
          {periods.map(([key, label]) => (
            <TabsTrigger key={key} value={key} className="text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Select value={period} onValueChange={choose}>
        <SelectTrigger aria-label="เลือกช่วงเวลา" className="w-36 md:hidden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periods.map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover
        open={custom}
        onOpenChange={(open) => {
          setCustom(open);
          if (open) {
            setDraft(range);
            setError("");
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="กำหนดช่วงวันที่">
            <CalendarDays />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(360px,calc(100vw-32px))]">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!validRange(draft)) {
                setError(
                  "ระบุวันที่ให้ถูกต้อง โดยวันเริ่มต้นต้องไม่เกินวันสิ้นสุด",
                );
                return;
              }
              onChange("custom", draft);
              setCustom(false);
            }}
          >
            <p className="text-sm font-semibold">กำหนดช่วงเวลา</p>
            {(["from", "to"] as const).map((key) => (
              <div className="space-y-2" key={key}>
                <Label htmlFor={`analytics-${key}`}>
                  {key === "from" ? "วันที่เริ่มต้น" : "วันที่สิ้นสุด"}
                </Label>
                <Input
                  id={`analytics-${key}`}
                  type="date"
                  required
                  value={draft[key]}
                  aria-invalid={!!error}
                  aria-describedby={error ? "analytics-range-error" : undefined}
                  onChange={(event) =>
                    setDraft({ ...draft, [key]: event.target.value })
                  }
                />
              </div>
            ))}
            {error && (
              <p
                id="analytics-range-error"
                role="alert"
                className="text-sm text-danger"
              >
                {error}
              </p>
            )}
            <Button type="submit" className="w-full">
              ใช้ช่วงเวลา
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
