"use client";

import { Button } from "@/src/components/ui/button";

type DocumentEditBannerProps = {
  documentNo: string;
  label?: string;
  disabled?: boolean;
  onCancel: () => void;
};

export function DocumentEditBanner({
  documentNo,
  label = "กำลังแก้ไขเอกสาร:",
  disabled = false,
  onCancel,
}: DocumentEditBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-sm text-primary">
        {label}{" "}
        <span className="font-medium">
          {documentNo}
        </span>
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={onCancel}
      >
        ยกเลิกเอกสาร
      </Button>
    </div>
  );
}