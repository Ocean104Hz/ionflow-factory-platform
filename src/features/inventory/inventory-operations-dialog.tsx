"use client";

import { useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { SelectField } from "@/src/components/factory/patterns";
import { ConfirmDialog } from "@/src/components/factory/confirm-dialog";
import { inventoryStatuses } from "./inventory-domain";
import { ledgerContext } from "./inventory-ledger-data";
import { stockKey } from "./inventory-ledger-domain";
import {
  inventoryQuantity,
  quantityDecimal,
  quantityUnits,
} from "./inventory-quantity";
import {
  commitStockOperation,
  nextOperationDocument,
  operationLocations,
  stockOperations,
  type OperationType,
  type StockCommand,
} from "./inventory-operations-domain";
import { useInventoryOperations } from "./inventory-operations-provider";

export function InventoryOperationsDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OperationType>("RECEIVE");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          ทำรายการสต็อก
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl motion-reduce:animate-none">
        <DialogHeader className="shrink-0 border-b p-5 pr-12">
          <DialogTitle>ทำรายการสต็อก · สาธิต</DialogTitle>
          <DialogDescription>
            เพิ่มเหตุการณ์ใน Ledger เท่านั้น · ไม่มีการบันทึกเข้าระบบจริง ·
            รีโหลดแล้วข้อมูลกลับค่าเริ่มต้น
          </DialogDescription>
        </DialogHeader>
        {open && (
          <OperationForm
            key={type}
            type={type}
            onTypeChange={setType}
            onClose={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function OperationForm({
  type,
  onTypeChange,
  onClose,
}: {
  type: OperationType;
  onTypeChange: (type: OperationType) => void;
  onClose: () => void;
}) {
  const id = useId();
  const { events, inventoryProjection, commit } = useInventoryOperations();
  const [metadata] = useState(() => ({
    operationId: crypto.randomUUID(),
    documentNo: nextOperationDocument(events, type),
    postedAt: new Date(
      Math.max(
        Date.now(),
        ...events.map((event) => Date.parse(event.postedAt)),
      ),
    ).toISOString(),
    actor: "เจ้าหน้าที่คลัง (สาธิต)",
  }));
  const [itemId, setItemId] = useState("");
  const [search, setSearch] = useState("");
  const [siteId, setSiteId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [sourceKey, setSourceKey] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [lotCode, setLotCode] = useState("");
  const [status, setStatus] =
    useState<keyof typeof inventoryStatuses>("QC_HOLD");
  const [destinationWarehouse, setDestinationWarehouse] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [amount, setAmount] = useState("");
  const [reviewedQuantity, setReviewedQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const posting = useRef(false);
  const balances = inventoryProjection.ok ? inventoryProjection.balances : [];
  const source = balances.find((p) => stockKey(p) === sourceKey);
  const item = ledgerContext.items.find((item) => item.id === itemId);
  const warehouses = ledgerContext.warehouses.filter(
    (w) => w.siteId === siteId,
  );
  const sources = balances.filter(
    (p) =>
      p.itemId === itemId &&
      p.siteId === siteId &&
      p.warehouseId === warehouseId &&
      (type === "ADJUST" ||
        (quantityUnits(p.onHandQty) > BigInt(0) &&
          (type === "ISSUE"
            ? p.inventoryStatus === "AVAILABLE"
            : p.inventoryStatus !== "BLOCKED"))),
  );
  const common = { ...metadata, note };
  const command: StockCommand =
    type === "RECEIVE"
      ? {
          ...common,
          type,
          quantity: amount,
          destination: {
            itemId,
            siteId,
            warehouseId,
            locationLabel,
            lotCode: lotCode.trim(),
            inventoryStatus: status,
            unit: item?.baseUnit ?? "",
          },
        }
      : type === "ADJUST"
        ? {
            ...common,
            type,
            sourceKey,
            countedQuantity: amount,
            reviewedQuantity,
            reason,
          }
        : type === "TRANSFER"
          ? {
              ...common,
              type,
              sourceKey,
              quantity: amount,
              warehouseId: destinationWarehouse,
              locationLabel: destinationLocation,
            }
          : { ...common, type, sourceKey, quantity: amount };
  const preview = commitStockOperation(events, command, ledgerContext);
  const displayedErrors = {
    ...(showErrors && !preview.ok ? preview.errors : {}),
    ...errors,
  };
  const stale =
    !success &&
    type === "ADJUST" &&
    source &&
    reviewedQuantity !== quantityDecimal(quantityUnits(source.onHandQty));
  let countDifference = "";
  if (type === "ADJUST" && source && amount) {
    try {
      const counted = quantityUnits(amount);
      if (counted >= BigInt(0))
        countDifference = inventoryQuantity(
          quantityDecimal(counted - quantityUnits(source.onHandQty)),
        );
    } catch {
      /* Invalid input is reported by command validation. */
    }
  }
  const errorText = (field: string) =>
    displayedErrors[field] && (
      <p
        id={`${id}-${field}-error`}
        role="alert"
        className="mt-1 text-xs text-danger"
      >
        {displayedErrors[field]}
      </p>
    );
  const options = (rows: readonly { id: string; name: string }[]) =>
    rows.map((row) => ({ value: row.id, label: row.name }));
  function clearSource() {
    setSourceKey("");
    setReviewedQuantity("");
    setErrors({});
  }
  function submit() {
    if (posting.current || success) return;
    posting.current = true;
    setBusy(true);
    try {
      const result = commit(command);
      if (result.ok) {
        setSuccess(
          `${result.duplicate ? "รายการนี้บันทึกไว้แล้ว" : "บันทึกรายการสาธิตแล้ว"}: ${result.event.documentNo}`,
        );
        setErrors({});
      } else {
        setErrors(result.errors);
        setShowErrors(true);
      }
    } finally {
      posting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <div className="min-h-0 space-y-5 overflow-y-auto p-5">
        <SelectField
          label="ประเภทรายการ"
          value={type}
          onChange={(value) => onTypeChange(value as OperationType)}
          options={Object.entries(stockOperations).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 text-xs sm:grid-cols-2">
          <p>
            เอกสาร: <span className="font-medium">{metadata.documentNo}</span>
          </p>
          <p>ผู้บันทึก: {metadata.actor}</p>
          <p className="sm:col-span-2">
            เวลาบันทึก:{" "}
            {new Date(metadata.postedAt).toLocaleString("th-TH", {
              timeZone: "Asia/Bangkok",
            })}{" "}
            (เวลาไทย)
          </p>
        </div>
        <fieldset disabled={busy || Boolean(success)} className="space-y-4">
          <legend className="mb-3 text-base font-semibold">
            {stockOperations[type]}
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={`${id}-search`}>ค้นหาสินค้าสำหรับทำรายการ</Label>
              <Input
                id={`${id}-search`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="รหัสหรือชื่อสินค้า"
              />
            </div>
            <div>
              <SelectField
                label="สินค้า *"
                value={itemId}
                onChange={(value) => {
                  setItemId(value);
                  clearSource();
                }}
                options={options(
                  ledgerContext.items
                    .filter(
                      (row) =>
                        row.id === itemId ||
                        `${row.code} ${row.name}`
                          .toLocaleLowerCase()
                          .includes(search.trim().toLocaleLowerCase()),
                    )
                    .map((row) => ({
                      ...row,
                      name: `${row.code} · ${row.name}`,
                    })),
                )}
              />
              {errorText("itemId")}
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor={`${id}-unit`}>หน่วยหลัก</Label>
              <Input id={`${id}-unit`} readOnly value={item?.baseUnit ?? ""} />
            </div>
            <SelectField
              label="โรงงาน / Site *"
              value={siteId}
              onChange={(value) => {
                setSiteId(value);
                setWarehouseId("");
                setLocationLabel("");
                setDestinationWarehouse("");
                setDestinationLocation("");
                clearSource();
              }}
              options={options(ledgerContext.sites)}
            />
            <div>
              <SelectField
                label={type === "RECEIVE" ? "คลังปลายทาง *" : "คลังต้นทาง *"}
                value={warehouseId}
                onChange={(value) => {
                  setWarehouseId(value);
                  setLocationLabel("");
                  clearSource();
                }}
                options={options(warehouses)}
              />
              {errorText("warehouseId")}
            </div>
            {type === "RECEIVE" ? (
              <>
                <div>
                  <SelectField
                    label="ตำแหน่งจัดเก็บ *"
                    value={locationLabel}
                    onChange={setLocationLabel}
                    options={operationLocations(ledgerContext, warehouseId).map(
                      (value) => ({ value, label: value }),
                    )}
                  />
                  {errorText("locationLabel")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-lot`}>Lot / Batch *</Label>
                  <Input
                    id={`${id}-lot`}
                    value={lotCode}
                    onChange={(e) => setLotCode(e.target.value)}
                    aria-invalid={Boolean(displayedErrors.lotCode)}
                    aria-describedby={
                      displayedErrors.lotCode
                        ? `${id}-lotCode-error`
                        : undefined
                    }
                  />
                  {errorText("lotCode")}
                </div>
                <SelectField
                  label="สถานะรับเข้า *"
                  value={status}
                  onChange={(value) => setStatus(value as typeof status)}
                  options={Object.entries(inventoryStatuses).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
                <p className="self-center text-xs text-muted-foreground">
                  AVAILABLE เป็นสถานะสมมติ ไม่ใช่การอนุมัติ QC จริง ·
                  ไม่ปล่อยยอด QC_HOLD เดิม
                </p>
              </>
            ) : (
              <div className="sm:col-span-2">
                <SelectField
                  label="ตำแหน่ง / Lot / สถานะต้นทาง *"
                  value={sourceKey}
                  onChange={(value) => {
                    const position = balances.find(
                      (p) => stockKey(p) === value,
                    );
                    setSourceKey(value);
                    setReviewedQuantity(
                      position
                        ? quantityDecimal(quantityUnits(position.onHandQty))
                        : "",
                    );
                    setErrors({});
                  }}
                  options={sources.map((p) => ({
                    value: stockKey(p),
                    label: `${p.locationLabel} · ${p.lotCode} · ${inventoryStatuses[p.inventoryStatus]} · ${inventoryQuantity(p.onHandQty)} ${p.unit}`,
                  }))}
                />
                {errorText("sourceKey")}
                {!sources.length && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    เลือกสินค้า โรงงาน และคลังก่อน ·
                    แสดงเฉพาะตำแหน่งที่ทำรายการประเภทนี้ได้
                  </p>
                )}
              </div>
            )}
            {type === "TRANSFER" && (
              <>
                <SelectField
                  label="คลังปลายทาง (โรงงานเดียวกัน) *"
                  value={destinationWarehouse}
                  onChange={(value) => {
                    setDestinationWarehouse(value);
                    setDestinationLocation("");
                  }}
                  options={options(warehouses)}
                />
                <div>
                  <SelectField
                    label="ตำแหน่งปลายทาง *"
                    value={destinationLocation}
                    onChange={setDestinationLocation}
                    options={operationLocations(
                      ledgerContext,
                      destinationWarehouse,
                    ).map((value) => ({ value, label: value }))}
                  />
                  {errorText("locationLabel")}
                </div>
                <p className="text-xs text-muted-foreground sm:col-span-2">
                  คง Lot หน่วย และสถานะเดิม · ไม่โอนข้ามโรงงานหรือปล่อย QC
                  โดยอัตโนมัติ
                </p>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor={`${id}-amount`}>
                {type === "ADJUST" ? "จำนวนตรวจนับจริง *" : "จำนวน *"}
              </Label>
              <Input
                id={`${id}-amount`}
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors({});
                }}
                aria-invalid={Boolean(
                  displayedErrors[
                    type === "ADJUST" ? "countedQuantity" : "quantity"
                  ],
                )}
                aria-describedby={
                  displayedErrors[
                    type === "ADJUST" ? "countedQuantity" : "quantity"
                  ]
                    ? `${id}-${type === "ADJUST" ? "countedQuantity" : "quantity"}-error`
                    : undefined
                }
                placeholder={
                  type === "ADJUST"
                    ? "0 หรือมากกว่า"
                    : "มากกว่า 0 · ทศนิยมไม่เกิน 6 ตำแหน่ง"
                }
              />
              {errorText(type === "ADJUST" ? "countedQuantity" : "quantity")}
            </div>
            {type === "ADJUST" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`${id}-system`}>
                    ยอดระบบล่าสุด (อ่านอย่างเดียว)
                  </Label>
                  <Input
                    id={`${id}-system`}
                    readOnly
                    value={source ? inventoryQuantity(source.onHandQty) : ""}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${id}-difference`}>
                    ส่วนต่างจากยอดระบบล่าสุด (อ่านอย่างเดียว)
                  </Label>
                  <Input
                    id={`${id}-difference`}
                    readOnly
                    value={countDifference}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${id}-reason`}>เหตุผลการปรับยอด *</Label>
                  <Textarea
                    id={`${id}-reason`}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setErrors({});
                    }}
                    aria-invalid={Boolean(displayedErrors.reason)}
                    aria-describedby={
                      displayedErrors.reason ? `${id}-reason-error` : undefined
                    }
                  />
                  {errorText("reason")}
                </div>
                {stale && (
                  <Alert className="sm:col-span-2">
                    <AlertDescription>
                      ยอดระบบเปลี่ยนแล้ว กรุณาตรวจสอบยอดล่าสุดก่อนยืนยัน{" "}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setReviewedQuantity(
                            quantityDecimal(quantityUnits(source.onHandQty)),
                          );
                          setErrors({});
                        }}
                      >
                        ทบทวนยอดล่าสุดแล้ว
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {errorText("reviewedQuantity")}
              </>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor={`${id}-note`}>หมายเหตุ / วัตถุประสงค์</Label>
              <Textarea
                id={`${id}-note`}
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </fieldset>
        {preview.ok && !success && (
          <section
            aria-label="ตัวอย่างยอดก่อนและหลัง"
            className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4"
          >
            <h3 className="text-sm font-semibold">ตรวจทานยอดก่อนบันทึก</h3>
            {preview.event.postings.map((p) => {
              const before = quantityUnits(
                balances.find((b) => stockKey(b) === stockKey(p))?.onHandQty ??
                  0,
              );
              const delta = quantityUnits(p.quantityDelta);
              return (
                <div key={p.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">
                    {
                      ledgerContext.warehouses.find(
                        (w) => w.id === p.warehouseId,
                      )?.name
                    }{" "}
                    · {p.locationLabel} · {p.lotCode} ·{" "}
                    {inventoryStatuses[p.inventoryStatus]}
                  </p>
                  <p className="mt-1 font-medium tabular-nums">
                    {inventoryQuantity(quantityDecimal(before))} →{" "}
                    {inventoryQuantity(quantityDecimal(before + delta))}{" "}
                    {p.unit}{" "}
                    <span
                      className={
                        delta < BigInt(0) ? "text-danger" : "text-success"
                      }
                    >
                      ({delta > BigInt(0) ? "+" : ""}
                      {inventoryQuantity(p.quantityDelta)})
                    </span>
                  </p>
                </div>
              );
            })}
          </section>
        )}
        {Object.entries(displayedErrors)
          .filter(([field]) =>
            [
              "form",
              "type",
              "operationId",
              "actor",
              "documentNo",
              "postedAt",
              "unit",
              "inventoryStatus",
            ].includes(field),
          )
          .map(([field, message]) => (
            <p key={field} role="alert" className="text-sm text-danger">
              {message}
            </p>
          ))}
        {success && (
          <Alert>
            <AlertDescription>
              <span role="status">{success} · ยอดและประวัติอัปเดตแล้ว</span>
            </AlertDescription>
          </Alert>
        )}
        <p className="text-xs text-muted-foreground">
          ตำแหน่งจัดเก็บใช้รายการอ้างอิง inventory สาธิต ·
          ยังไม่เชื่อมตั้งค่าหรือธุรกรรมโมดูลอื่น ·
          รายการที่บันทึกแล้วแก้ไข/ลบไม่ได้
        </p>
      </div>
      <DialogFooter className="shrink-0 border-t bg-card p-4">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {success ? "ปิด" : "ยกเลิก"}
        </Button>
        {!success &&
          (preview.ok ? (
            <ConfirmDialog
              title={`ยืนยัน${stockOperations[type]}`}
              description={`${metadata.documentNo} · ตรวจทานยอดก่อน/หลังข้างต้นแล้ว รายการจะเพิ่มเข้า Ledger และแก้ไขหรือลบไม่ได้`}
              onConfirm={submit}
              trigger={<Button disabled={busy}>ตรวจทานและบันทึก</Button>}
            />
          ) : (
            <Button
              onClick={() => {
                setShowErrors(true);
                setErrors({});
              }}
              disabled={busy}
            >
              ตรวจสอบข้อมูลก่อนบันทึก
            </Button>
          ))}
      </DialogFooter>
    </>
  );
}
