"use client";

import { RowActionItem, RowActionMenu } from "@/src/components/factory/row-action-menu";
import { useState } from "react";
import {
    Eye,
    Pencil,
    Printer,
    Search,
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

    const [filters, setFilters] =
        useState<MaterialIssueHistoryFilters>({
            ...EMPTY_MATERIAL_ISSUE_FILTERS,
        });

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [error, setError] = useState("");

    const filteredRecords =
        filterMaterialIssueRecords(
            records,
            filters,
        );

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

    function handleSearch(): void {
        if (
            draft.dateFrom &&
            draft.dateTo &&
            draft.dateFrom > draft.dateTo
        ) {
            setError(
                "วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด",
            );

            return;
        }

        setFilters({ ...draft });
        setPage(1);
        setError("");
    }

    function handleClearFilters(): void {
        setDraft({
            ...EMPTY_MATERIAL_ISSUE_FILTERS,
        });

        setFilters({
            ...EMPTY_MATERIAL_ISSUE_FILTERS,
        });

        setPage(1);
        setError("");
    }

    return (
        <div className="min-w-0 space-y-4">

            {/* ตัวกรองประวัติ */}
            <SectionCard
                title="ประวัติใบเบิกจ่ายวัสดุ"
                subtitle={`พบ ${filteredRecords.length} จาก ${records.length} เอกสารสาธิต`}
            >
                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        handleSearch();
                    }}
                >
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

                        {/* ค้นหา */}
                        <div className="grid content-start gap-2">
                            <Label htmlFor="material-issue-history-search">
                                ค้นหาใบเบิกจ่ายวัสดุ
                            </Label>

                            <Input
                                id="material-issue-history-search"
                                value={draft.search}
                                placeholder="เลขที่เอกสาร ชื่อผลิตภัณฑ์ หรือผู้เบิก"
                                onChange={(event) =>
                                    setDraft((previous) => ({
                                        ...previous,
                                        search: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        {/* ตั้งแต่วันที่ */}
                        <ThaiBuddhistDatePicker
                            label="ตั้งแต่วันที่"
                            value={draft.dateFrom}
                            onChange={(value) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    dateFrom: value,
                                }))
                            }
                        />

                        {/* ถึงวันที่ */}
                        <ThaiBuddhistDatePicker
                            label="ถึงวันที่"
                            value={draft.dateTo}
                            onChange={(value) =>
                                setDraft((previous) => ({
                                    ...previous,
                                    dateTo: value,
                                }))
                            }
                        />

                        {/* ปุ่มค้นหา */}
                        <div className="flex flex-wrap items-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClearFilters}
                            >
                                ล้างตัวกรอง
                            </Button>

                            <Button type="submit">
                                <Search
                                    className="size-4"
                                    aria-hidden="true"
                                />
                                ค้นหา
                            </Button>
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
            </SectionCard>

            {/* จำนวนต่อหน้า */}
            <div className="ml-auto w-36">
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
                            <RowActionMenu containsDialog>
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
        </div>
    );
}