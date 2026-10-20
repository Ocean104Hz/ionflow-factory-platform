"use client";

import { useState } from "react";
import { FileSearch, Info } from "lucide-react";
import { Badge } from "@/src/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/src/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/src/components/ui/alert";
import {
  FactoryDataTable,
  InfoGrid,
  InfoRow,
  SelectField,
  StatusBadge,
  type Column,
} from "@/src/components/factory/patterns";
import {
  inventoryIntegrationScenarios,
  scenarioKnownActions,
} from "@/src/lib/mock-data/inventory-integration-scenarios";
import {
  integrationModules,
  integrationResultLabels,
  type PreviewPosition,
} from "./inventory-integration-contracts";
import { previewInventoryIntegration } from "./inventory-integration-preview-domain";
import { ledgerContext } from "./inventory-ledger-data";
import { inventoryStatuses } from "./inventory-domain";
import { inventoryQuantity, quantityUnits } from "./inventory-quantity";
import { useInventoryOperations } from "./inventory-operations-provider";

const effectLabels = {
  NONE: "ไม่มีผลกระทบต่อสต็อก",
  RECEIPT: "รับเข้า (ข้อเสนอ)",
  ISSUE: "เบิก / จ่ายออก (ข้อเสนอ)",
  QC_STATUS_CHANGE: "เปลี่ยนสถานะ QC โดยคงยอดรวม (ข้อเสนอ)",
  MANUFACTURING_CONVERSION: "แปรรูปสินค้า / บรรจุ (ยังไม่รองรับ)",
};
export function InventoryIntegrationPreview() {
  const { events } = useInventoryOperations();
  const [module, setModule] = useState("ALL");
  const [selected, setSelected] = useState("pr-created");
  const scenarios = inventoryIntegrationScenarios.filter(
    (row) => module === "ALL" || row.sourceReference.sourceModule === module,
  );
  const scenario = scenarios.find((row) => row.id === selected) ?? scenarios[0];
  const result = previewInventoryIntegration(
    scenario,
    events,
    ledgerContext,
    scenarioKnownActions(scenario.id),
  );
  const source = result.sourceReference;
  const tone =
    result.state === "BLOCKED"
      ? "destructive"
      : result.state === "DESIGN_PENDING"
        ? "warning"
        : result.state === "READY_TO_PREVIEW"
          ? "info"
          : "neutral";
  const columns: Column<PreviewPosition>[] = [
    {
      key: "item",
      label: "สินค้า / Lot",
      render: (row) => (
        <div className="min-w-48">
          <p className="font-medium">
            {
              ledgerContext.items.find(
                (item) => item.id === row.position.itemId,
              )?.code
            }
          </p>
          <p className="text-xs text-muted-foreground">
            {
              ledgerContext.items.find(
                (item) => item.id === row.position.itemId,
              )?.name
            }
          </p>
          <p className="mt-1 text-xs">Lot: {row.position.lotCode}</p>
        </div>
      ),
    },
    {
      key: "warehouse",
      label: "โรงงาน / คลัง / ตำแหน่ง",
      render: (row) => (
        <div className="min-w-48">
          <p>
            {
              ledgerContext.sites.find(
                (site) => site.id === row.position.siteId,
              )?.name
            }
          </p>
          <p>
            {
              ledgerContext.warehouses.find(
                (warehouse) => warehouse.id === row.position.warehouseId,
              )?.name
            }
          </p>
          <p className="text-xs text-muted-foreground">
            {row.position.locationLabel}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "สถานะสต็อก",
      render: (row) => (
        <StatusBadge
          tone={
            row.position.inventoryStatus === "BLOCKED"
              ? "destructive"
              : row.position.inventoryStatus === "QC_HOLD"
                ? "warning"
                : "neutral"
          }
        >
          {inventoryStatuses[row.position.inventoryStatus]}
        </StatusBadge>
      ),
    },
    {
      key: "before",
      label: "ยอดปัจจุบัน",
      numeric: true,
      render: (row) => inventoryQuantity(row.before),
    },
    {
      key: "delta",
      label: "ส่วนต่างที่เสนอ",
      numeric: true,
      render: (row) => (
        <span
          className={
            quantityUnits(row.delta) < BigInt(0) ? "text-danger" : "text-info"
          }
        >
          {quantityUnits(row.delta) > BigInt(0) ? "+" : ""}
          {inventoryQuantity(row.delta)}
        </span>
      ),
    },
    {
      key: "after",
      label: "ยอดหลังจำลอง (ไม่บันทึก)",
      numeric: true,
      render: (row) => inventoryQuantity(row.after),
    },
    { key: "unit", label: "หน่วยหลัก", render: (row) => row.position.unit },
  ];
  return (
    <section
      className="min-w-0 space-y-4"
      aria-label="ตัวอย่างการเชื่อมโมดูล"
      data-posting-supported={result.postingSupported}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileSearch aria-hidden="true" className="size-5 text-primary" />
            ตัวอย่างการเชื่อมโมดูล
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            แสดงผลกระทบต่อสต็อกที่อาจเกิดขึ้นจากเอกสารโรงงานโดยใช้ข้อมูลจำลอง
            ไม่มีการบันทึก Stock Ledger
          </p>
        </div>
        <Badge variant="outline">MOCK PREVIEW · อ่านอย่างเดียว</Badge>
      </div>
      <Alert>
        <Info aria-hidden="true" />
        <AlertTitle>
          เป็นข้อเสนอการเชื่อมต่อ ไม่ใช่ฟังก์ชันที่เปิดใช้งานแล้ว
        </AlertTitle>
        <AlertDescription>
          เอกสารทั้งหมดด้านล่างเป็นสถานการณ์สมมติ ไม่ได้ดึงจาก PR/BOM/QC จริง
          การเปลี่ยนตัวอย่างไม่รับ เบิก อนุมัติ หรือจ่ายสินค้า · Ledger ปัจจุบัน{" "}
          {events.length} เหตุการณ์ · preview เพิ่ม 0 เหตุการณ์
        </AlertDescription>
      </Alert>
      <Card className="gap-3 py-4 shadow-none">
        <CardContent className="grid gap-4 px-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <SelectField
            label="โมดูลต้นทาง"
            value={module}
            onChange={(value) => {
              setModule(value);
              setSelected(
                inventoryIntegrationScenarios.find(
                  (row) =>
                    value === "ALL" ||
                    row.sourceReference.sourceModule === value,
                )!.id,
              );
            }}
            options={[
              { value: "ALL", label: "ทุกโมดูล" },
              ...Object.entries(integrationModules).map(([value, label]) => ({
                value,
                label,
              })),
            ]}
          />
          <SelectField
            label="เอกสารตัวอย่าง (ไม่ใช่เอกสารจริง)"
            value={scenario.id}
            onChange={setSelected}
            options={scenarios.map((row) => ({
              value: row.id,
              label: row.label,
            }))}
          />
        </CardContent>
      </Card>
      <Card className="gap-4 py-4 shadow-none">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">ข้อมูลต้นทางจำลอง</CardTitle>
            <div role="status" aria-live="polite">
              <StatusBadge tone={tone}>
                {integrationResultLabels[result.state]}
              </StatusBadge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-4">
          <InfoGrid>
            <InfoRow label="โมดูล">
              {integrationModules[source.sourceModule]}
            </InfoRow>
            <InfoRow label="เลขเอกสารสมมติ">
              {source.sourceDocumentNumber}
            </InfoRow>
            <InfoRow label="Document ID / Line ID">
              <span className="break-all">
                {source.sourceDocumentId} / {source.sourceLineId || "ไม่ระบุ"}
              </span>
            </InfoRow>
            <InfoRow label="Lifecycle">{scenario.sourceLifecycle}</InfoRow>
            <InfoRow label="Milestone (ข้อเสนอ)">
              {source.businessMilestone}
            </InfoRow>
            <InfoRow label="ผลกระทบที่เสนอ">
              {effectLabels[result.proposedEffect.effectType]}
            </InfoRow>
          </InfoGrid>
          {"position" in scenario.intent && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed">
              <p>
                Mapping ที่ระบุในตัวอย่าง: Item{" "}
                {scenario.intent.position.itemId || "ยังไม่ระบุ"} · Site{" "}
                {scenario.intent.position.siteId || "ยังไม่ระบุ"} · Warehouse{" "}
                {scenario.intent.position.warehouseId || "ยังไม่ระบุ"}
              </p>
              <p>
                Lot {scenario.intent.position.lotCode || "ยังไม่ระบุ"} ·{" "}
                {scenario.intent.position.locationLabel} · จำนวน{" "}
                {scenario.intent.quantity} {scenario.intent.position.unit}
              </p>
            </div>
          )}
          <p className="break-all text-xs text-muted-foreground">
            Stable source-action identity:{" "}
            {result.proposedEffect.idempotencyKey}
          </p>
          <p className="text-xs text-muted-foreground">
            การบันทึกจาก preview: ไม่รองรับ · READY_TO_PREVIEW
            ไม่ได้หมายถึงอนุมัติหรือบันทึกแล้ว
          </p>
        </CardContent>
      </Card>
      {result.state === "READY_TO_PREVIEW" && (
        <div className="space-y-2">
          <h3 className="text-base font-semibold">
            ผลต่อแต่ละตำแหน่ง หากดำเนินการตามข้อเสนอ
          </h3>
          <FactoryDataTable
            columns={columns}
            rows={[...result.positions]}
            rowKey={(row) => JSON.stringify(row.position)}
            minWidth={1050}
          />
          <p className="text-xs text-muted-foreground">
            ตัวเลขหลังจำลองไม่แทนยอดปัจจุบัน และไม่มี Stock Ledger event ใหม่
          </p>
        </div>
      )}
      <Alert variant={result.state === "BLOCKED" ? "destructive" : "default"}>
        <AlertTitle>{integrationResultLabels[result.state]}</AlertTitle>
        <AlertDescription>
          <ul className="list-disc space-y-1 pl-4">
            {[...result.blockingReasons, ...result.warnings].map(
              (message, index) => (
                <li key={index}>{message}</li>
              ),
            )}
          </ul>
        </AlertDescription>
      </Alert>
      {scenario.id.startsWith("duplicate-") && (
        <p className="text-xs text-muted-foreground">
          ตรวจซ้ำกับ known source actions จำลองแบบ read-only เท่านั้น
          ไม่ใช่เหตุการณ์ที่บันทึกไว้ใน Ledger เซสชันนี้
        </p>
      )}
    </section>
  );
}
