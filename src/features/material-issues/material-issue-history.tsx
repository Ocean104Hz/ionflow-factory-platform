"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useState } from "react";
import {
    Eye,
    Pencil,
    Printer,
    Trash2,
} from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

import ThaiBuddhistDatePicker from "@/src/components/ui/thai-buddhist-date-picker";

import {
    SectionCard,
    FactoryDataTable,
    Pagination,
    SelectField,
} from "@/src/components/factory/patterns";

import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";

import { formatThaiDate } from "@/src/lib/date/thai-date";

import {
    EMPTY_MATERIAL_ISSUE_FILTERS,
    filterMaterialIssueRecords,
    type MaterialIssueHistoryFilters,
    type MaterialIssueRecord,
} from "./material-issue-domain";

type MaterialIssueHistoryProps = {
    records: MaterialIssueRecord[];
    onView: (record: MaterialIssueRecord) => void;
    onEdit: (record: MaterialIssueRecord) => void;
    onDelete: (record: MaterialIssueRecord) => void;
};

export function MaterialIssueHistory({
    records,
    onView,
    onEdit,
    onDelete,
}: MaterialIssueHistoryProps) {
    const [draft, setDraft] =
        useState<MaterialIssueHistoryFilters>({
            ...EMPTY_MATERIAL_ISSUE_FILTERS,
        });

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const error = draft.dateFrom && draft.dateTo && draft.dateFrom > draft.dateTo
        ? "วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด"
        : "";

    const filteredRecords = error
        ? []
        : filterMaterialIssueRecords(records, draft);

    const totalPages = Math.max(
        1,
        Math.ceil(
            filteredRecords.length / pageSize,
        ),
    );

    const currentPage = Math.min(
        page,
        totalPages,
    );

    const visibleRecords =
        filteredRecords.slice(
            (currentPage - 1) * pageSize,
            currentPage * pageSize,
        );


    return (
        <div className="min-w-0 space-y-4">

            {/* ตัวกรองประวัติ */}
            <SectionCard
                title="ข้อมูลที่บันทึก"
                contentClassName="space-y-3"
            >
                <form
                    className="space-y-3"
                    onSubmit={(event) => event.preventDefault()}
                >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,.65fr)]">

                        {/* ค้นหา */}
                        <div className="grid content-start gap-2">
                            <Label htmlFor="material-issue-history-search">
                                ค้นหาใบเบิกจ่ายวัสดุ
                            </Label>

                            <Input
                                id="material-issue-history-search"
                                value={draft.search}
                                placeholder="เลขที่เอกสาร ชื่อผลิตภัณฑ์ หรือผู้เบิก"
                                onChange={(event) => {
                                    setDraft((previous) => ({
                                        ...previous,
                                        search: event.target.value,
                                    }));
                                    setPage(1);
                                }}
                            />
                        </div>

                        {/* ตั้งแต่วันที่ */}
                        <div className="factory-itech-date-filter min-w-0">
                            <ThaiBuddhistDatePicker
                                label="ตั้งแต่วันที่"
                                value={draft.dateFrom}
                                onChange={(value) => {
                                    setDraft((previous) => ({
                                        ...previous,
                                        dateFrom: value,
                                    }));
                                    setPage(1);
                                }}
                            />
                        </div>

                        {/* ถึงวันที่ */}
                        <div className="factory-itech-date-filter min-w-0">
                            <ThaiBuddhistDatePicker
                                label="ถึงวันที่"
                                value={draft.dateTo}
                                onChange={(value) => {
                                    setDraft((previous) => ({
                                        ...previous,
                                        dateTo: value,
                                    }));
                                    setPage(1);
                                }}
                            />
                        </div>

                        {/* จำนวนต่อหน้า */}
                        <div className="min-w-0">
                            <SelectField
                                label="จำนวนต่อหน้า"
                                value={String(pageSize)}
                                onChange={(value) => {
                                    setPageSize(Number(value));
                                    setPage(1);
                                }}
                                options={[5, 10, 20].map(
                                    (size) => ({
                                        value: String(size),
                                        label: `${size} รายการ`,
                                    }),
                                )}
                            />
                        </div>
                    </div>

                    {error && (
                        <p
                            role="alert"
                            className="text-sm text-destructive"
                        >
                            {error}
                        </p>
                    )}
                </form>

            {/* ตารางประวัติ */}
            <FactoryDataTable variant="history"
                rows={visibleRecords}
                rowKey={(record) => record.id}
                minWidth={1100}
                columns={[
                    {
                        key: "documentNo",
                        label: "เลขที่เอกสาร",
                        render: (record) => (
                            <Button
                                type="button"
                                variant="link"
                                className="h-auto max-w-44 whitespace-normal break-all p-0 text-left"
                                onClick={() => onView(record)}
                            >
                                {record.documentNo}
                            </Button>
                        ),
                    },
                    {
                        key: "issueDate",
                        label: "วันที่",
                        render: (record) =>
                            formatThaiDate(
                                record.header.issueDate,
                            ) || "-",
                    },
                    {
                        key: "location",
                        label: "สถานที่",
                        render: (record) =>
                            record.header.location || "-",
                    },
                    {
                        key: "productName",
                        label: "ชื่อผลิตภัณฑ์",
                        render: (record) => (
                            <div className="max-w-60 whitespace-normal wrap-break-word">
                                <p>
                                    {record.header.productName ||
                                        "-"}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                    {record.items.length}{" "}
                                    รายการวัสดุ
                                </p>
                            </div>
                        ),
                    },
                    {
                        key: "quantity",
                        label: "จำนวน",
                        render: (record) =>
                            record.header.quantity || "-",
                    },
                    {
                        key: "department",
                        label: "ฝ่าย",
                        render: (record) =>
                            record.header.department || "-",
                    },
                    {
                        key: "requestedBy",
                        label: "ผู้เบิก",
                        render: (record) =>
                            record.signers.requestedBy || "-",
                    },
                    {
                        key: "actions",
                        label: "จัดการ",
                        render: (record) => (
                            <RowActionMenu appearance="itech" containsDialog>
                                {/* ดูรายละเอียด */}
                                <RowActionItem type="button" title="ดูรายละเอียด" aria-label="ดูรายละเอียด" onClick={() => onView(record)}>
                                    <Eye className="size-4" />
                                 ดูรายละเอียด</RowActionItem>

                                {/* แก้ไข */}
                                <RowActionItem type="button" title="แก้ไข" aria-label="แก้ไข" onClick={() => onEdit(record)}>
                                    <Pencil className="size-4" />
                                 แก้ไข</RowActionItem>

                                {/* พิมพ์เอกสาร */}
                                <RowActionItem type="button" title="พิมพ์เอกสาร" aria-label="พิมพ์เอกสาร" onClick={() => {
                                        window.alert("ยังไม่ได้พัฒนาระบบพิมพ์เอกสาร");
                                    }}>
                                    <Printer className="size-4" />
                                 พิมพ์เอกสาร</RowActionItem>

                                {/* ลบเอกสาร */}
                                <ConfirmDialog
                                    title={`ลบ ${record.documentNo}?`}
                                    description="เป็นการลบข้อมูลใบเบิกจ่ายวัสดุตัวอย่างเท่านั้น ไม่มีผลต่อฐานข้อมูลหรือสต็อกจริง"
                                    trigger={
                                        <RowActionItem type="button" title="ลบเอกสาร" aria-label="ลบเอกสาร" className="w-full justify-start text-destructive">
                                            <Trash2 className="size-4" />
                                         ลบเอกสาร</RowActionItem>
                                    }
                                    onConfirm={() => onDelete(record)}
                                />
                            </RowActionMenu>
                        ),
                    },
                ]}
                pagination={
                    <Pagination
                        page={currentPage}
                        pageSize={pageSize}
                        total={filteredRecords.length}
                        onChange={setPage}
                    />
                }
            />
            </SectionCard>
        </div>
    );
}