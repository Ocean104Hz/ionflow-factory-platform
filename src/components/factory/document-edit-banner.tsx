
"use client";

type DocumentEditBannerProps = {
  documentNumber: string;
  onCancel: () => void;
  disabled?: boolean;
};

export function DocumentEditBanner({
  documentNumber,
  onCancel,
  disabled = false,
}: DocumentEditBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
      <p role="status">
        กำลังแก้ไขเอกสาร:{" "}
        <strong>{documentNumber}</strong>
      </p>

      <button
        type="button"
        onClick={onCancel}
        disabled={disabled}
        className="font-medium underline underline-offset-2 hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-amber-100"
      >
        ยกเลิกการแก้ไข
      </button>
    </div>
  );
}
