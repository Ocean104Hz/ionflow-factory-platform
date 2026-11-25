"use client";

import { useRef, useState } from "react";
import { Save } from "lucide-react";

import {
    PageHeader,
    StatusBadge,
} from "@/src/components/factory/patterns";

import { Button } from "@/src/components/ui/button";

import {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
} from "@/src/components/ui/tabs";

import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogAction,
    AlertDialogCancel,
} from "@/src/components/ui/alert-dialog";

import { MaterialIssueHeader } from "./material-issue-header";
import { MaterialIssueItems } from "./material-issue-items";
import { MaterialIssueSigners } from "./material-issue-signers";

import { MaterialIssueHistory } from "./material-issue-history";
import { MaterialIssueDetailModal } from "./material-issue-detail-modal";

import {
    createEmptyMaterialIssueDraft,
    createEmptyMaterialIssueItem,
    type MaterialIssueDraft,
    type MaterialIssueHeaderValues,
    type MaterialIssueItem,
    type MaterialIssueSignersValues,
    type MaterialIssueRecord,
} from "./material-issue-domain";

type PendingFormAction =
    | {
        type: "new";
    }
    | {
        type: "edit";
        record: MaterialIssueRecord;
    };

export function MaterialIssueWorkspace() {
    const [tab, setTab] = useState("form");

    const [records] = useState<
        MaterialIssueRecord[]
    >([]);

    const [header, setHeader] =
        useState<MaterialIssueHeaderValues>(
            () =>
                createEmptyMaterialIssueDraft()
                    .header,
        );

    const [items, setItems] = useState<
        MaterialIssueItem[]
    >(
        () =>
            createEmptyMaterialIssueDraft()
                .items,
    );

    const [signers, setSigners] =
        useState<MaterialIssueSignersValues>(
            () =>
                createEmptyMaterialIssueDraft()
                    .signers,
        );

    const [editingId, setEditingId] =
        useState<string | null>(null);

    const [viewRecordId, setViewRecordId] =
        useState<string | null>(null);

    const [pendingAction, setPendingAction] =
        useState<PendingFormAction | null>(null);

    const [message, setMessage] = useState("");

    const [error, setError] = useState("");

    const [baseline, setBaseline] =
        useState(() =>
            JSON.stringify(
                createEmptyMaterialIssueDraft(),
            ),
        );

    const nextRowId = useRef(4);

    function handleSave(): void {
        clearMessages();

        setError(
            "ยังไม่สามารถบันทึกเอกสารได้ เนื่องจากยังไม่ได้เชื่อมต่อฐานข้อมูล",
        );
    }

    const currentDraft: MaterialIssueDraft = {
        header,
        items,
        signers,
    };

    const hasUnsavedChanges =
        JSON.stringify(currentDraft) !== baseline;

    const editingRecord = records.find(
        (record) => record.id === editingId,
    );

    const viewedRecord = records.find(
        (record) => record.id === viewRecordId,
    );

    function clearMessages(): void {
        setMessage("");
        setError("");
    }

    /* ==============================
       Header
    ============================== */

    function handleHeaderChange(
        field: keyof MaterialIssueHeaderValues,
        value: string,
    ): void {
        setHeader((previous) => ({
            ...previous,
            [field]: value,
        }));

        clearMessages();
    }

    /* ==============================
       Material Items
    ============================== */

    function handleItemChange(
        id: string,
        field: Exclude<
            keyof MaterialIssueItem,
            "id"
        >,
        value: string,
    ): void {
        setItems((previous) =>
            previous.map((item) =>
                item.id === id
                    ? {
                        ...item,
                        [field]: value,
                    }
                    : item,
            ),
        );

        clearMessages();
    }

    function handleAddItem(): void {
        const id = `row-${nextRowId.current}`;

        nextRowId.current += 1;

        setItems((previous) => [
            ...previous,
            createEmptyMaterialIssueItem(id),
        ]);

        clearMessages();
    }

    function handleRemoveItem(
        id: string,
    ): void {
        setItems((previous) => {
            if (previous.length <= 1) {
                return previous;
            }

            return previous.filter(
                (item) => item.id !== id,
            );
        });

        clearMessages();
    }

    /* ==============================
       Signers
    ============================== */

    function handleSignersChange(
        field: keyof MaterialIssueSignersValues,
        value: string,
    ): void {
        setSigners((previous) => ({
            ...previous,
            [field]: value,
        }));

        clearMessages();
    }

    /* ==============================
       Reset / Open Document
    ============================== */

    function resetForm(): void {
        const draft =
            createEmptyMaterialIssueDraft();

        setHeader(draft.header);
        setItems(draft.items);
        setSigners(draft.signers);

        setEditingId(null);

        setBaseline(JSON.stringify(draft));

        nextRowId.current = 4;

        setTab("form");

        clearMessages();
    }

    function openRecord(
        record: MaterialIssueRecord,
    ): void {
        const copiedRecord =
            structuredClone(record);

        const draft: MaterialIssueDraft = {
            header: copiedRecord.header,
            items:
                copiedRecord.items.length > 0
                    ? copiedRecord.items
                    : [
                        createEmptyMaterialIssueItem(
                            "row-1",
                        ),
                    ],
            signers: copiedRecord.signers,
        };

        setHeader(draft.header);
        setItems(draft.items);
        setSigners(draft.signers);

        setEditingId(record.id);

        setBaseline(JSON.stringify(draft));

        const highestRowId = Math.max(
            0,
            ...draft.items.map((item) => {
                const match =
                    /^row-(\d+)$/.exec(item.id);

                return match
                    ? Number(match[1])
                    : 0;
            }),
        );

        nextRowId.current = highestRowId + 1;

        setTab("form");

        clearMessages();
    }

    function requestNewDocument(): void {
        if (hasUnsavedChanges) {
            setPendingAction({
                type: "new",
            });

            return;
        }

        resetForm();
    }

    function handleEditRecord(
        record: MaterialIssueRecord,
    ): void {
        if (hasUnsavedChanges) {
            setPendingAction({
                type: "edit",
                record,
            });

            return;
        }

        openRecord(record);
    }

    function confirmPendingAction(): void {
        if (!pendingAction) return;

        if (pendingAction.type === "new") {
            resetForm();
        } else {
            openRecord(pendingAction.record);
        }

        setPendingAction(null);
    }

    /* ==============================
       History Actions
    ============================== */

    function handleDeleteRecord(
        record: MaterialIssueRecord,
    ): void {
        clearMessages();

        setError(
            `ยังไม่สามารถลบเอกสาร ${record.documentNo} ได้ เนื่องจากยังไม่ได้เชื่อมต่อฐานข้อมูล`,
        );
    }

    return (
        <div className="min-w-0 space-y-5">

            {/* Page Header */}
            <PageHeader
                title="ใบเบิกจ่ายวัสดุ"
                actions={
                    <StatusBadge tone="info">
                        ยังไม่เชื่อมต่อฐานข้อมูล
                    </StatusBadge>
                }
            />

            {/* Tabs */}
            <Tabs
                value={tab}
                onValueChange={setTab}
                className="min-w-0"
            >
                <div className="max-w-full overflow-x-auto">
                    <TabsList aria-label="มุมมองใบเบิกจ่ายวัสดุ">
                        <TabsTrigger value="form">
                            สร้างใบเบิกจ่ายวัสดุ
                        </TabsTrigger>

                        <TabsTrigger value="history">
                            ประวัติใบเบิกจ่ายวัสดุ
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Messages */}
                {message && (
                    <div
                        role="status"
                        className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary"
                    >
                        {message}
                    </div>
                )}

                {error && (
                    <div
                        role="alert"
                        className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                    >
                        {error}
                    </div>
                )}

                {/* ==========================
            Tab: Form
        ========================== */}

                <TabsContent
                    value="form"
                    className="mt-3 min-w-0"
                >
                    <div className="space-y-5">

                        {editingRecord && (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                                <p className="text-sm text-primary">
                                    กำลังแก้ไขใบเบิกจ่ายวัสดุ:
                                    {" "}
                                    <span className="font-medium">
                                        {
                                            editingRecord.documentNo
                                        }
                                    </span>
                                </p>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={
                                        requestNewDocument
                                    }
                                >
                                    สร้างเอกสารใหม่
                                </Button>
                            </div>
                        )}

                        {/* ฟอร์มเดิม */}
                        <MaterialIssueHeader
                            values={header}
                            onChange={
                                handleHeaderChange
                            }
                        />

                        <MaterialIssueItems
                            items={items}
                            onChange={handleItemChange}
                            onAdd={handleAddItem}
                            onRemove={handleRemoveItem}
                        />

                        <MaterialIssueSigners
                            values={signers}
                            onChange={
                                handleSignersChange
                            }
                        />

                        {/* Save */}
                        <div className="no-print flex flex-wrap items-center justify-end gap-3">
                            <Button
                                type="button"
                                onClick={handleSave}
                            >
                                <Save className="size-4" />
                                บันทึก
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* ==========================
            Tab: History
        ========================== */}

                <TabsContent
                    value="history"
                    className="mt-3 min-w-0"
                >
                    <MaterialIssueHistory
                        records={records}
                        onView={(record) =>
                            setViewRecordId(record.id)
                        }
                        onEdit={handleEditRecord}
                        onDelete={handleDeleteRecord}
                    />
                </TabsContent>
            </Tabs>

            {/* Confirm Unsaved Changes */}
            <AlertDialog
                open={pendingAction !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingAction(null);
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            ละทิ้งข้อมูลที่ยังไม่บันทึก?
                        </AlertDialogTitle>

                        <AlertDialogDescription>
                            ข้อมูลที่กำลังกรอกหรือแก้ไขอยู่จะถูกล้าง
                            หากยังไม่ได้บันทึก
                            การสลับแท็บเพียงอย่างเดียวจะไม่ล้างข้อมูล
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <AlertDialogFooter>
                        <AlertDialogCancel>
                            กลับไปแก้ไข
                        </AlertDialogCancel>

                        <AlertDialogAction
                            onClick={
                                confirmPendingAction
                            }
                        >
                            ยืนยันละทิ้งข้อมูล
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Detail Modal */}
            {viewedRecord && (
                <MaterialIssueDetailModal
                    key={viewedRecord.id}
                    record={viewedRecord}
                    onClose={() =>
                        setViewRecordId(null)
                    }
                />
            )}
        </div>
    );
}