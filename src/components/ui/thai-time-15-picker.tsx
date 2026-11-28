"use client";

import { useId } from "react";
import { getThaiTime15Options } from "@/src/lib/date/thai-time-15";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

type ThaiTime15PickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowEmpty?: boolean;
  error?: string;
};

const EMPTY_OPTION = "__empty__";

export default function ThaiTime15Picker({
  label,
  value,
  onChange,
  disabled = false,
  allowEmpty = true,
  error,
}: ThaiTime15PickerProps) {
  const errorId = `${useId()}-error`;
  const options = getThaiTime15Options(value);
  const selected = options.includes(value) ? value : "";

  return (
    <div className="min-w-0 space-y-1">
      <Select
        value={selected || (allowEmpty ? EMPTY_OPTION : "")}
        disabled={disabled}
        onValueChange={(next) => {
          if (disabled) return;
          if (next === EMPTY_OPTION && allowEmpty) onChange("");
          else if (options.includes(next)) onChange(next);
        }}
      >
        <SelectTrigger
          aria-label={label}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="w-full min-w-0 bg-surface px-2 tabular-nums"
        >
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-60">
          {allowEmpty && <SelectItem value={EMPTY_OPTION}>--</SelectItem>}
          {options.map((time) => (
            <SelectItem key={time} value={time}>
              {time}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
