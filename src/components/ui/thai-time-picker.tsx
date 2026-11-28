"use client";

import { useId } from "react";
import { cn } from "cn";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

import {
  THAI_TIME_HOURS,
  THAI_TIME_MINUTES,
  parseThaiTime,
  setThaiTimePart,
  type ThaiTimePart,
} from "@/src/lib/date/thai-time";

type ThaiTimePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  error?: string;
  className?: string;
};

const EMPTY_OPTION = "__empty__";

const triggerClass =
  "min-w-0 w-full gap-0 px-1 tabular-nums [&_svg]:size-3";

export default function ThaiTimePicker({
  label,
  value,
  onChange,
  disabled = false,
  allowEmpty = true,
  error,
  className,
}: ThaiTimePickerProps) {
  const id = useId();

  const parsed = parseThaiTime(value);
  const errorId = `${id}-error`;

  function changePart(
    part: ThaiTimePart,
    selection: string,
  ) {
    if (
      disabled ||
      (!allowEmpty && selection === EMPTY_OPTION)
    ) {
      return;
    }

    const next = setThaiTimePart(
      value,
      part,
      selection === EMPTY_OPTION ? "" : selection,
    );

    if (next !== null && next !== value) onChange(next);
  }

  return (
    <div className={cn("min-w-0 space-y-1", className)}>
      <div
        role="group"
        aria-label={label}
        className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1"
      >
        {/* ชั่วโมง */}

        <Select
          value={
            parsed?.hour ??
            (allowEmpty ? EMPTY_OPTION : "")
          }
          onValueChange={(next) => changePart("hour", next)}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={`${label} (ชั่วโมง)`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={triggerClass}
          >
            <SelectValue placeholder="--" />
          </SelectTrigger>

          <SelectContent
            position="popper"
            className="max-h-60"
          >
            {allowEmpty && (
              <SelectItem value={EMPTY_OPTION}>
                --
              </SelectItem>
            )}

            {THAI_TIME_HOURS.map((hour) => (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span
          aria-hidden="true"
          className="text-sm text-muted-foreground"
        >
          :
        </span>

        {/* นาที */}

        <Select
          value={
            parsed?.minute ??
            (allowEmpty ? EMPTY_OPTION : "")
          }
          onValueChange={(next) => changePart("minute", next)}
          disabled={disabled}
        >
          <SelectTrigger
            aria-label={`${label} (นาที)`}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={triggerClass}
          >
            <SelectValue placeholder="--" />
          </SelectTrigger>

          <SelectContent
            position="popper"
            className="max-h-60"
          >
            {allowEmpty && (
              <SelectItem value={EMPTY_OPTION}>
                --
              </SelectItem>
            )}

            {THAI_TIME_MINUTES.map((minute) => (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error */}

      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}