"use client";

import {
  useEffect,
  useId,
  useRef,
} from "react";

import { Printer, X } from "lucide-react";

import { Button } from "@/src/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";

import { formatThaiDate } from "@/src/lib/date/thai-date";

import type {
  MaterialIssueRecord,
} from "./material-issue-domain";

type MaterialIssueDetailModalProps = {
  record: MaterialIssueRecord;
  onClose: () => void;
};

type DetailFieldProps = {
  label: string;
  value: string;
};

function DetailField({
  label,
  value,
}: DetailFieldProps) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-sm font-medium">
        {label}
      </p>

      <div className="min-h-9 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm wrap-break-word">
        {value || "-"}
      </div>
    </div>
  );
}

export function MaterialIssueDetailModal({
  record,
  onClose,
}: MaterialIssueDetailModalProps) {
  const titleId = useId();

  const dialogRef =
    useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="factory-itech-theme fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-6xl overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[85vh] flex-col">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold"
            >
              รายละเอียดใบเบิกจ่ายวัสดุ
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {record.documentNo}
            </p>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="ปิดหน้าต่าง"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 space-y-5 overflow-auto p-5">

          {/* ข้อมูลหัวเอกสาร */}
          <section className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">
              ข้อมูลใบเบิกจ่ายวัสดุ
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <DetailField
                label="เลขที่เอกสาร"
                value={record.documentNo}
              />

              <DetailField
                label="สถานที่"
                value={record.header.location}
              />

              <DetailField
                label="วันที่"
                value={formatThaiDate(
                  record.header.issueDate,
                )}
              />

              <DetailField
                label="ชื่อผลิตภัณฑ์"
                value={
                  record.header.productName
                }
              />

              <DetailField
                label="จำนวน"
                value={record.header.quantity}
              />

              <DetailField
                label="ฝ่าย"
                value={
                  record.header.department
                }
              />
            </div>
          </section>

          {/* รายการวัสดุ */}
          <section className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">
              รายการวัสดุ
            </h3>

            <div className="overflow-x-auto rounded-md border">
              <Table className="factory-itech-form-table min-w-212.5">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead
                      rowSpan={2}
                      className="w-16 border-r text-center"
                    >
                      ลำดับ
                    </TableHead>

                    <TableHead
                      rowSpan={2}
                      className="border-r"
                    >
                      รหัส
                    </TableHead>

                    <TableHead
                      rowSpan={2}
                      className="min-w-56 border-r"
                    >
                      รายการวัสดุ
                    </TableHead>

                    <TableHead
                      rowSpan={2}
                      className="border-r text-center"
                    >
                      จำนวน
                    </TableHead>

                    <TableHead
                      rowSpan={2}
                      className="border-r text-center"
                    >
                      หน่วย
                    </TableHead>

                    <TableHead
                      colSpan={2}
                      className="text-center"
                    >
                      หมายเหตุ
                    </TableHead>
                  </TableRow>

                  <TableRow>
                    <TableHead className="border-r text-center">
                      ชำรุด
                    </TableHead>

                    <TableHead className="text-center">
                      เบิกเพิ่ม
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {record.items.length > 0 ? (
                    record.items.map(
                      (item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="border-r text-center">
                            {index + 1}
                          </TableCell>

                          <TableCell className="border-r">
                            {item.materialCode ||
                              "-"}
                          </TableCell>

                          <TableCell className="border-r whitespace-normal">
                            {item.materialName ||
                              "-"}
                          </TableCell>

                          <TableCell className="border-r text-right">
                            {item.quantity ||
                              "-"}
                          </TableCell>

                          <TableCell className="border-r text-center">
                            {item.unit || "-"}
                          </TableCell>

                          <TableCell className="border-r text-center">
                            {item.damagedQuantity ||
                              "-"}
                          </TableCell>

                          <TableCell className="text-center">
                            {item.additionalQuantity ||
                              "-"}
                          </TableCell>
                        </TableRow>
                      ),
                    )
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        ไม่มีรายการวัสดุ
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <p className="text-sm text-muted-foreground">
              ทั้งหมด {record.items.length} รายการ
            </p>
          </section>

          {/* ผู้รับผิดชอบ */}
          <section className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">
              ผู้รับผิดชอบ
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <DetailField
                label="ผู้เบิก"
                value={
                  record.signers.requestedBy
                }
              />

              <DetailField
                label="ผู้จ่าย"
                value={record.signers.issuedBy}
              />

              <DetailField
                label="ผู้ตรวจสอบ"
                value={
                  record.signers.inspectedBy
                }
              />
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 border-t px-5 py-4">
          <Button
            type="button"
            onClick={() => {
              window.alert("ยังไม่ได้พัฒนาระบบพิมพ์เอกสาร");
            }}
          >
            <Printer className="size-4" aria-hidden="true" />
            พิมพ์
          </Button>
        </div>
      </div>
    </dialog>
  );
}