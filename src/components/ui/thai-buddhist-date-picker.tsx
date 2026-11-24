"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import {
  THAI_MONTHS,
  THAI_WEEKDAYS,
  buildCalendarDays,
  formatThaiDate,
  parseISODateString,
  todayInBangkok,
} from "@/src/lib/date/thai-date";

type ThaiBuddhistDatePickerProps = {
  label: string;
  value: string;
  onChange: (nextValue: string) => void;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
};

type PopupPosition = {
  top: number;
  left: number;
};

const POPUP_WIDTH = 272;
const POPUP_HEIGHT_ESTIMATE = 340;
const VIEWPORT_GAP = 12;
const TRIGGER_GAP = 8;

export default function ThaiBuddhistDatePicker({
  label,
  value,
  onChange,
  error,
  placeholder = "วว/ดด/ปปปป",
  disabled = false,
}: ThaiBuddhistDatePickerProps) {
  const id = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(
    () => parseISODateString(value),
    [value],
  );

  const [open, setOpen] = useState(false);

  const [todayIso, setTodayIso] = useState("");

  const [portalHost, setPortalHost] =
    useState<HTMLElement | null>(null);

  const [viewYear, setViewYear] = useState(
    selectedDate?.getFullYear() ?? 2000,
  );

  const [viewMonth, setViewMonth] = useState(
    selectedDate?.getMonth() ?? 0,
  );

  const [popupPosition, setPopupPosition] =
    useState<PopupPosition>({
      top: 0,
      left: 0,
    });

  const updatePopupPosition = useCallback(() => {
    const trigger = buttonRef.current;

    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();

    const maxLeft = Math.max(
      VIEWPORT_GAP,
      window.innerWidth -
        POPUP_WIDTH -
        VIEWPORT_GAP,
    );

    const left = Math.min(
      Math.max(rect.left, VIEWPORT_GAP),
      maxLeft,
    );

    const openUpward =
      window.innerHeight - rect.bottom <
        POPUP_HEIGHT_ESTIMATE &&
      rect.top > POPUP_HEIGHT_ESTIMATE;

    const top = openUpward
      ? Math.max(
          VIEWPORT_GAP,
          rect.top -
            POPUP_HEIGHT_ESTIMATE -
            TRIGGER_GAP,
        )
      : Math.max(
          VIEWPORT_GAP,
          Math.min(
            rect.bottom + TRIGGER_GAP,
            window.innerHeight -
              POPUP_HEIGHT_ESTIMATE -
              VIEWPORT_GAP,
          ),
        );

    setPopupPosition({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;

      if (containerRef.current?.contains(target)) {
        return;
      }

      if (popupRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener(
      "mousedown",
      handleMouseDown,
    );

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    window.addEventListener(
      "resize",
      updatePopupPosition,
    );

    window.addEventListener(
      "scroll",
      updatePopupPosition,
      true,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown,
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      window.removeEventListener(
        "resize",
        updatePopupPosition,
      );

      window.removeEventListener(
        "scroll",
        updatePopupPosition,
        true,
      );
    };
  }, [open, updatePopupPosition]);

  const calendarDays = useMemo(
    () => buildCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const displayValue = selectedDate
    ? formatThaiDate(value)
    : "";

  function changeMonth(offset: number): void {
    const next = new Date(
      viewYear,
      viewMonth + offset,
      1,
    );

    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function handleSelectDate(iso: string): void {
    onChange(iso);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleToggleOpen(): void {
    if (disabled) return;

    if (open) {
      setOpen(false);
      return;
    }

    const currentDate = todayInBangkok();

    const baseDate =
      selectedDate ??
      parseISODateString(currentDate);

    if (!baseDate) return;

    setTodayIso(currentDate);

    setViewYear(baseDate.getFullYear());
    setViewMonth(baseDate.getMonth());

    const dialog = buttonRef.current?.closest(
      "dialog[open], [role='dialog']",
    );

    setPortalHost(
      dialog instanceof HTMLElement
        ? dialog
        : document.body,
    );

    updatePopupPosition();
    setOpen(true);
  }

  const popup =
    open && portalHost
      ? createPortal(
          <div
            ref={popupRef}
            id={`${id}-calendar`}
            role="dialog"
            aria-label="เลือกวันที่"
            className="fixed z-9999 w-68 max-w-[calc(100vw-24px)] rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg"
            style={{
              top: popupPosition.top,
              left: popupPosition.left,
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="flex size-7 items-center justify-center rounded-md border hover:bg-accent"
                aria-label="เดือนก่อนหน้า"
              >
                <ChevronLeft className="size-4" />
              </button>

              <div className="text-sm font-semibold">
                {THAI_MONTHS[viewMonth]}{" "}
                {viewYear + 543}
              </div>

              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="flex size-7 items-center justify-center rounded-md border hover:bg-accent"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {THAI_WEEKDAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((cell) => {
                const isSelected =
                  cell.iso === value;

                const isToday =
                  cell.iso === todayIso;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    aria-label={formatThaiDate(
                      cell.iso,
                    )}
                    aria-pressed={isSelected}
                    onClick={() =>
                      handleSelectDate(cell.iso)
                    }
                    className={`h-8 rounded-md border text-xs transition ${
                      isSelected
                        ? "border-primary bg-primary font-medium text-primary-foreground"
                        : cell.inCurrentMonth
                          ? "text-foreground hover:bg-accent"
                          : "text-muted-foreground/60 hover:bg-accent"
                    } ${
                      isToday && !isSelected
                        ? "border-primary"
                        : isSelected
                          ? ""
                          : "border-transparent"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={() =>
                  handleSelectDate(
                    todayInBangkok(),
                  )
                }
                className="text-xs font-medium text-primary hover:underline"
              >
                วันนี้
              </button>

              <button
                type="button"
                onClick={() => handleSelectDate("")}
                className="text-xs text-muted-foreground hover:underline"
              >
                ล้างวันที่
              </button>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className="text-xs text-muted-foreground hover:underline"
              >
                ปิด
              </button>
            </div>
          </div>,
          portalHost,
        )
      : null;

  return (
    <>
      <div
        ref={containerRef}
        className="space-y-2"
      >
        {label ? (
          <label
            htmlFor={`${id}-trigger`}
            className="block text-sm font-medium"
          >
            {label}
          </label>
        ) : null}

        <button
          id={`${id}-trigger`}
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={handleToggleOpen}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={
            open ? `${id}-calendar` : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? `${id}-error` : undefined
          }
          className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-left text-sm shadow-xs outline-none transition disabled:cursor-not-allowed disabled:opacity-50 ${
            error
              ? "border-destructive"
              : "border-input focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          }`}
        >
          <span
            className={
              displayValue
                ? "text-foreground"
                : "text-muted-foreground"
            }
          >
            {displayValue || placeholder}
          </span>

          <CalendarDays
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </button>

        {error ? (
          <p
            id={`${id}-error`}
            className="text-xs text-destructive"
          >
            {error}
          </p>
        ) : null}
      </div>

      {popup}
    </>
  );
}