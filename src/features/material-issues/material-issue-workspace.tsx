"use client";

import { useEffect, useRef, useState } from "react";
import { Save } from "lucide-react";

import { Button } from "@/src/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/src/components/ui/tabs";
import { DocumentEditBanner } from "@/src/components/factory/document-edit-banner";

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

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasStringFields(value: unknown, fields: readonly string[]): boolean {
    return isObject(value) && fields.every((field) => typeof value[field] === "string");
}

function isMaterialIssueRecord(value: unknown): value is MaterialIssueRecord {
    return isObject(value) &&
        typeof value.id === "string" &&
        typeof value.documentNo === "string" &&
        typeof value.version === "string" &&
        /^[1-9]\d*$/.test(value.version) &&
        hasStringFields(value.header, ["location", "productName", "quantity", "issueDate", "department"]) &&
        hasStringFields(value.signers, ["requestedBy", "issuedBy", "inspectedBy"]) &&
        Array.isArray(value.items) &&
        value.items.every((item: unknown) => hasStringFields(item, ["id", "materialCode", "materialName", "quantity", "unit", "damagedQuantity", "additionalQuantity"]));
}

async function readApiData<T>(response: Response, validate: (value: unknown) => value is T, fallback: string): Promise<T> {
    const result: unknown = await response.json();
    if (!response.ok || !isObject(result) || result.ok !== true) {
        throw new Error(isObject(result) && typeof result.message === "string" ? result.message : fallback);
    }
    if (!validate(result.data)) {
        throw new Error("ข้อมูลตอบกลับจากระบบไม่ถูกต้อง กรุณาโหลดหน้าใหม่");
    }
    return result.data;
}

async function getCsrfToken(): Promise<string> {
    const response = await fetch("/api/auth/csrf", { cache: "no-store" });
    const result: unknown = await response.json();
    if (!response.ok || !isObject(result) || result.ok !== true || typeof result.csrfToken !== "string" || !result.csrfToken) {
        throw new Error("ไม่สามารถยืนยันคำขอได้");
    }
    return result.csrfToken;
}

async function fetchRecord(id: string): Promise<MaterialIssueRecord> {
    const response = await fetch(`/api/material-issues?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    return readApiData(response, (value): value is MaterialIssueRecord => isMaterialIssueRecord(value) && value.id === id, "โหลดเอกสารไม่สำเร็จ");
}

export function MaterialIssueWorkspace() {
    const [tab, setTab] = useState("form");

    const [records, setRecords] = useState<
        MaterialIssueRecord[]
    >([]);

    const [saving, setSaving] = useState(false);

    const [connected, setConnected] = useState(false);

    const savingRef = useRef(false);

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

    const [editingVersion, setEditingVersion] = useState<string | null>(null);
    const [documentNo, setDocumentNo] = useState("");
    const [baselineDocumentNo, setBaselineDocumentNo] = useState("");

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
    useEffect(() => {
        const controller = new AbortController();

        async function loadRecords() {
            try {
                const response = await fetch(
                    "/api/material-issues",
                    {
                        cache: "no-store",
                        signal: controller.signal,
                    },
                );

                const data = await readApiData(
                    response,
                    (value): value is MaterialIssueRecord[] => Array.isArray(value) && value.every(isMaterialIssueRecord),
                    "โหลดประวัติไม่สำเร็จ",
                );

                if (!controller.signal.aborted) {
                    setRecords(data);
                    setConnected(true);
                }
            } catch (error: unknown) {
                if (controller.signal.aborted) return;

                setConnected(false);

                setError(
                    error instanceof Error
                        ? error.message
                        : "โหลดประวัติไม่สำเร็จ",
                );
            }
        }

        void loadRecords();

        return () => controller.abort();
    }, []);


    async function handleSave(): Promise<void> {
        if (savingRef.current) return;

        clearMessages();
        const requiredFields = [
            { label: "เลขที่เอกสาร", value: documentNo },
            { label: "วันที่", value: header.issueDate },
            { label: "สถานที่", value: header.location },
            { label: "ชื่อผลิตภัณฑ์", value: header.productName },
            { label: "จำนวน", value: header.quantity },
            { label: "ฝ่าย", value: header.department },
        ];

        const missingFields = requiredFields.filter(
            (field) => !field.value.trim(),
        );

        if (missingFields.length > 0) {
            setError(
                `กรุณากรอกข้อมูลให้ครบถ้วน: ${missingFields
                    .map((field) => field.label)
                    .join(", ")}`,
            );

            return;
        }

        if (
            !Number.isFinite(Number(header.quantity)) ||
            Number(header.quantity) <= 0
        ) {
            setError("จำนวนผลิตภัณฑ์ต้องมากกว่า 0");
            return;
        }

        if (!connected) {
            setError("กรุณาโหลดข้อมูลจากระบบให้สำเร็จก่อนบันทึก");
            return;
        }

        if (editingId && !editingVersion) {
            setError("กรุณาเปิดเอกสารใหม่ก่อนแก้ไข");
            return;
        }

        savingRef.current = true;
        setSaving(true);

        try {
            const csrfToken = await getCsrfToken();
            const response = await fetch(
                editingId ? `/api/material-issues?id=${encodeURIComponent(editingId)}` : "/api/material-issues",
                {
                    method: editingId ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-csrf-token": csrfToken,
                    },
                    body: JSON.stringify({
                        documentNo: documentNo.trim(),
                        header,
                        items,
                        signers,
                        ...(editingId ? { version: editingVersion } : {}),
                    }),
                },
            );

            const record = await readApiData(
                response,
                (value): value is MaterialIssueRecord => isMaterialIssueRecord(value) && (!editingId || value.id === editingId),
                "บันทึกเอกสารไม่สำเร็จ",
            );

            setRecords((previous) => [
                record,
                ...previous.filter(
                    (entry) => entry.id !== record.id,
                ),
            ]);

            resetForm();

            setConnected(true);

            setMessage(
                editingId ? "แก้ไขใบเบิกจ่ายวัสดุสำเร็จ" : "บันทึกใบเบิกจ่ายวัสดุสำเร็จ",
            );

            setTab("history");
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "บันทึกเอกสารไม่สำเร็จ",
            );
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    const currentDraft: MaterialIssueDraft = {
        header,
        items,
        signers,
    };

    const hasUnsavedChanges =
        JSON.stringify(currentDraft) !== baseline ||
        documentNo !== baselineDocumentNo;

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
        if (savingRef.current) return;

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
        if (savingRef.current) return;

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
        if (savingRef.current) return;

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
        if (savingRef.current) return;

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
        if (savingRef.current) return;

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
        setEditingVersion(null);
        setDocumentNo("");
        setBaselineDocumentNo("");

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
        setEditingVersion(record.version);
        setDocumentNo(record.documentNo);
        setBaselineDocumentNo(record.documentNo);

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
        if (savingRef.current) return;

        if (hasUnsavedChanges) {
            setPendingAction({
                type: "new",
            });

            return;
        }

        resetForm();
    }

    async function handleEditRecord(record: MaterialIssueRecord): Promise<void> {
        if (savingRef.current) return;
        clearMessages();
        savingRef.current = true;
        setSaving(true);
        try {
            const latest = await fetchRecord(record.id);
            setRecords((previous) => previous.map((entry) => entry.id === latest.id ? latest : entry));
            if (hasUnsavedChanges) {
                setPendingAction({ type: "edit", record: latest });
                return;
            }
            openRecord(latest);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "เปิดเอกสารไม่สำเร็จ");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    function confirmPendingAction(): void {
        if (savingRef.current) return;

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

    async function handleViewRecord(record: MaterialIssueRecord): Promise<void> {
        if (savingRef.current) return;
        clearMessages();
        savingRef.current = true;
        setSaving(true);
        try {
            const latest = await fetchRecord(record.id);
            setRecords((previous) => previous.map((entry) => entry.id === latest.id ? latest : entry));
            setViewRecordId(latest.id);
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "โหลดรายละเอียดไม่สำเร็จ");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    async function handleDeleteRecord(record: MaterialIssueRecord): Promise<void> {
        if (savingRef.current) return;
        clearMessages();
        if (editingId === record.id && hasUnsavedChanges) {
            setError("กรุณายกเลิกข้อมูลที่กำลังแก้ไขก่อนลบเอกสาร");
            return;
        }
        savingRef.current = true;
        setSaving(true);
        try {
            const csrfToken = await getCsrfToken();
            const response = await fetch(`/api/material-issues?id=${encodeURIComponent(record.id)}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-token": csrfToken,
                },
                body: JSON.stringify({ version: record.version }),
            });
            await readApiData(response, (value): value is { id: string } => isObject(value) && value.id === record.id, "ลบเอกสารไม่สำเร็จ");
            setRecords((previous) => previous.filter((entry) => entry.id !== record.id));
            if (viewRecordId === record.id) setViewRecordId(null);
            if (editingId === record.id) resetForm();
            setTab("history");
            setMessage("ลบใบเบิกจ่ายวัสดุสำเร็จ");
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : "ลบเอกสารไม่สำเร็จ");
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }

    return (
        <div className="factory-itech-theme min-w-0 space-y-5">

            <Tabs value={tab} activationMode="manual" className="min-w-0 gap-3" onValueChange={(value) => {
                if (savingRef.current || saving) return;
                if (value === "form" || value === "history") setTab(value);
            }}>
                <TabsList aria-label="ใบเบิกจ่ายวัสดุ" className="factory-itech-tabs">
                    <TabsTrigger value="form" disabled={saving}>กรอกข้อมูล</TabsTrigger>
                    <TabsTrigger value="history" disabled={saving}>ดูประวัติ</TabsTrigger>
                </TabsList>

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

                <TabsContent value="form" className="mt-3 min-w-0">
                    <div className="space-y-5">

                        {editingRecord && (
                            <DocumentEditBanner
                                label="กำลังแก้ไขใบเบิกจ่ายวัสดุ:"
                                documentNo={editingRecord.documentNo}
                                disabled={saving}
                                onCancel={requestNewDocument}
                            />
                        )}

                        {/* ฟอร์มเดิม */}
                        <MaterialIssueHeader
                            documentNo={documentNo}
                            onDocumentNoChange={(value) => {
                                if (savingRef.current) return;
                                setDocumentNo(value);
                                clearMessages();
                            }}
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
                                disabled={saving}
                            >
                                <Save className="size-4" />
                                {saving ? "กำลังบันทึก..." : "บันทึก"}
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* ==========================
            Tab: History
        ========================== */}

                <TabsContent value="history" className="mt-3 min-w-0">
                    <MaterialIssueHistory
                        records={records}
                        onView={handleViewRecord}
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