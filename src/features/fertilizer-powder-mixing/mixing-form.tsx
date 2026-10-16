"use client";
import { useRef, useState } from "react";
import { MixingHeader } from "./mixing-header";
import { MixingMaterialTable } from "./mixing-material-table";
import { MixingRoundTable } from "./mixing-round-table";
import { MixingSigners } from "./mixing-signers";
import { useMixing } from "./mixing-provider";
import {
  MixingValidationError,
  type MixingReport,
  type FieldErrors,
} from "./mixing-domain";
export function MixingForm({
  initial,
  onSaved,
}: {
  initial: MixingReport;
  onSaved: () => void;
}) {
  const [row, setRow] = useState(() => structuredClone(initial));
  const [errors, setErrors] = useState<FieldErrors>({});
  const summary = useRef<HTMLDivElement>(null);
  const { save } = useMixing();
  const patch = (value: Partial<MixingReport>) =>
    setRow((r) => ({ ...r, ...value }));
  return (
    <form
      id="mixing-editor"
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          save(row);
          onSaved();
        } catch (error) {
          setErrors(
            error instanceof MixingValidationError
              ? error.fields
              : {
                  general:
                    error instanceof Error ? error.message : "บันทึกไม่สำเร็จ",
                },
          );
          summary.current?.focus();
        }
      }}
    >
      <div ref={summary} tabIndex={-1} className="scroll-mt-4 outline-none">
        {Object.keys(errors).length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-danger"
          >
            <p className="font-medium">
              ยังบันทึกไม่ได้ กรุณาแก้ไขช่องที่ระบุด้านล่าง
            </p>
            <ul className="mt-2 list-inside list-disc text-sm">
              {Object.entries(errors).map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <MixingHeader row={row} onChange={patch} errors={errors} />
      <MixingMaterialTable
        rows={row.materials}
        onChange={(materials) => patch({ materials })}
        errors={errors}
      />
      <MixingRoundTable
        rows={row.mix_rounds}
        day={row.report_date}
        shift={row.shift}
        onChange={(mix_rounds) => patch({ mix_rounds })}
        errors={errors}
      />
      <MixingSigners row={row} onChange={patch} errors={errors} />
    </form>
  );
}
