import type { ReceivingHeaderValues } from "./receiving-header";
import {
  inboundNumberPreview,
  legacyInboundCounters,
  type InboundNumberPreview,
  type InboundReservation,
} from "./document-number";
import {
  calculateReceivingTotals,
  validateReceivingDraft,
  type ReceivingItem,
  type ReceivingSigners,
} from "./receiving-domain";

export const INB_MOCK_DOCUMENTS_KEY =
  "ionflow.factory.inbound.mock-documents.v1";

type MockStorage = Pick<Storage, "getItem" | "setItem">;

export type SavedReceivingDocument = {
  header: ReceivingHeaderValues;
  items: ReceivingItem[];
  note: string;
  signers: ReceivingSigners;
  amountTotal: string;
  quantityByUnit: { unit: string; quantity: string }[];
  savedAt: string;
};

type DocumentState = {
  version: 1;
  latestDocNo: string | null;
  documents: SavedReceivingDocument[];
  reservations?: InboundReservation[];
  counters?: Record<string, number>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const headerStrings = [
  "location",
  "receiveDate",
  "poDate",
  "documentNo",
  "poNo",
  "supplierCode",
  "supplierName",
  "prNo",
  "warehouseCode",
  "vendorBookNo",
  "vendorDocumentNo",
] as const;
const itemStrings = [
  "id",
  "source",
  "quantity",
  "unit",
  "description",
  "orderNoticeDate",
  "materialCode",
  "unitPrice",
] as const;
const signerStrings = [
  "issuerName",
  "approverName",
  "recorderName",
  "inspectorName",
] as const;

function isSavedDocument(value: unknown): value is SavedReceivingDocument {
  if (!record(value) || !record(value.header) || !record(value.signers))
    return false;
  if (
    !headerStrings.every(
      (key) =>
        typeof (value.header as Record<string, unknown>)[key] === "string",
    )
  )
    return false;
  if (
    !Array.isArray(value.header.qcDocumentNumbers) ||
    !value.header.qcDocumentNumbers.every((n: unknown) => typeof n === "string")
  )
    return false;
  if (
    !signerStrings.every(
      (key) =>
        typeof (value.signers as Record<string, unknown>)[key] === "string",
    )
  )
    return false;
  if (
    !Array.isArray(value.items) ||
    !value.items.every(
      (v: unknown) =>
        record(v) &&
        itemStrings.every((key) => typeof v[key] === "string") &&
        v.source === "manual",
    )
  )
    return false;
  if (
    typeof value.note !== "string" ||
    typeof value.amountTotal !== "string" ||
    typeof value.savedAt !== "string"
  )
    return false;
  if (
    !Array.isArray(value.quantityByUnit) ||
    !value.quantityByUnit.every(
      (v: unknown) =>
        record(v) &&
        typeof v.unit === "string" &&
        typeof v.quantity === "string",
    )
  )
    return false;
  return validateReceivingDraft(
    value.header as ReceivingHeaderValues,
    value.items as ReceivingItem[],
  ).valid;
}

function validReservation(value: unknown): value is InboundReservation {
  if (
    !record(value) ||
    typeof value.period !== "string" ||
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(value.period) ||
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 1 ||
    typeof value.token !== "string" ||
    !value.token ||
    !["reserved", "used"].includes(String(value.status)) ||
    typeof value.reservedAt !== "string" ||
    typeof value.expiresAt !== "string"
  )
    return false;
  try {
    const expected = inboundNumberPreview(
      `${value.period}-01`,
      Number(value.sequence),
    );
    return (
      value.documentNo === expected.documentNo &&
      value.year === expected.year &&
      value.month === expected.month &&
      Number.isFinite(Date.parse(value.reservedAt)) &&
      Date.parse(value.expiresAt) - Date.parse(value.reservedAt) ===
        24 * 60 * 60 * 1000
    );
  } catch {
    return false;
  }
}

function readState(storage: MockStorage): DocumentState {
  const raw = storage.getItem(INB_MOCK_DOCUMENTS_KEY);
  if (raw === null) return { version: 1, latestDocNo: null, documents: [] };
  let value: unknown;
  try {
    value = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(
      "ข้อมูลใบรับทดลองในเบราว์เซอร์เสียหาย ระบบจะไม่เขียนทับข้อมูลเดิม",
    );
  }
  if (
    !record(value) ||
    value.version !== 1 ||
    (value.latestDocNo !== null && typeof value.latestDocNo !== "string") ||
    !Array.isArray(value.documents) ||
    !value.documents.every(isSavedDocument)
  ) {
    throw new Error("ข้อมูลใบรับทดลองไม่ถูกต้อง ระบบจะไม่เขียนทับข้อมูลเดิม");
  }
  const state = value as DocumentState;
  if (
    new Set(state.documents.map((doc) => doc.header.documentNo)).size !==
      state.documents.length ||
    (state.latestDocNo !== null &&
      !state.documents.some(
        (doc) => doc.header.documentNo === state.latestDocNo,
      ))
  ) {
    throw new Error(
      "ข้อมูลอ้างอิงใบรับทดลองไม่ถูกต้อง ระบบจะไม่เขียนทับข้อมูลเดิม",
    );
  }
  if (
    (state.reservations !== undefined &&
      (!Array.isArray(state.reservations) ||
        !state.reservations.every(validReservation))) ||
    (state.counters !== undefined &&
      (!record(state.counters) ||
        Object.entries(state.counters).some(
          ([key, n]) =>
            !/^\d{4}-(0[1-9]|1[0-2])$/.test(key) ||
            !Number.isSafeInteger(n) ||
            n < 0,
        )))
  )
    throw new Error(
      "ข้อมูลจองเลข INB ทดลองเสียหาย ระบบจะไม่เขียนทับข้อมูลเดิม",
    );
  const reservations = state.reservations ?? [];
  if (
    new Set(reservations.map((r) => r.documentNo)).size !==
      reservations.length ||
    new Set(reservations.map((r) => r.token)).size !== reservations.length
  )
    throw new Error("ข้อมูลจองเลข INB ซ้ำ ระบบจะไม่เขียนทับข้อมูลเดิม");
  return state;
}

function nextNumber(
  storage: MockStorage,
  state: DocumentState,
  date: string,
  now: Date,
): InboundNumberPreview {
  const first = inboundNumberPreview(date, 1);
  if (!Number.isFinite(now.getTime()))
    throw new Error("เวลาปัจจุบันไม่ถูกต้อง");
  const counters = legacyInboundCounters(storage),
    reservations = state.reservations ?? [];
  const savedNumbers = new Set(
    state.documents.map((doc) => doc.header.documentNo),
  );
  const expired = reservations
    .filter(
      (r) =>
        r.period === first.period &&
        r.status === "reserved" &&
        Date.parse(r.expiresAt) <= now.getTime() &&
        !savedNumbers.has(r.documentNo),
    )
    .sort((a, b) => a.sequence - b.sequence)[0];
  if (expired) return inboundNumberPreview(date, expired.sequence);
  const shortPeriod = date.slice(2, 4) + date.slice(5, 7);
  const savedSequences = state.documents
    .filter((doc) => doc.header.receiveDate.slice(0, 7) === first.period)
    .map((doc) => Number(doc.header.documentNo.slice(8)));
  let sequence =
    Math.max(
      counters[shortPeriod] ?? 0,
      state.counters?.[first.period] ?? 0,
      ...savedSequences,
      ...reservations
        .filter((r) => r.period === first.period)
        .map((r) => r.sequence),
    ) + 1;
  let candidate = inboundNumberPreview(date, sequence);
  while (
    savedNumbers.has(candidate.documentNo) ||
    reservations.some((r) => r.documentNo === candidate.documentNo)
  )
    candidate = inboundNumberPreview(date, ++sequence);
  return candidate;
}

export function previewMockInboundNumber(
  storage: MockStorage,
  date: string,
  now: Date = new Date(),
): InboundNumberPreview {
  return nextNumber(storage, readState(storage), date, now);
}

export function reserveMockInboundNumber(
  storage: MockStorage,
  date: string,
  expected: string,
  token: string,
  now: Date = new Date(),
):
  | { ok: true; reservation: InboundReservation }
  | { ok: false; preview: InboundNumberPreview; message: string } {
  const state = readState(storage),
    preview = nextNumber(storage, state, date, now);
  if (preview.documentNo !== expected)
    return {
      ok: false,
      preview,
      message: `เลข ${expected} ไม่ว่างแล้ว ขณะนี้เสนอ ${preview.documentNo} กรุณายืนยันอีกครั้ง`,
    };
  if (!token || (state.reservations ?? []).some((r) => r.token === token))
    throw new Error("รหัสจองไม่ถูกต้อง กรุณาลองใหม่");
  const reservation: InboundReservation = {
    ...preview,
    token,
    status: "reserved",
    reservedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
  storage.setItem(
    INB_MOCK_DOCUMENTS_KEY,
    JSON.stringify({
      ...state,
      reservations: [
        ...(state.reservations ?? []).filter((r) => r.documentNo !== expected),
        reservation,
      ],
      counters: {
        ...state.counters,
        [preview.period]: Math.max(
          state.counters?.[preview.period] ?? 0,
          preview.sequence,
        ),
      },
    } satisfies DocumentState),
  );
  return { ok: true, reservation };
}

export function listMockReceivingDocuments(
  storage: MockStorage,
): SavedReceivingDocument[] {
  return readState(storage).documents;
}

export function isMockReceivingNumberSaved(
  storage: MockStorage,
  docNo: string,
): boolean {
  return readState(storage).documents.some(
    (r) => r.header.documentNo === docNo,
  );
}

export function loadLatestMockReceivingDocument(
  storage: MockStorage,
): SavedReceivingDocument | null {
  const state = readState(storage);
  return (
    state.documents.find((r) => r.header.documentNo === state.latestDocNo) ??
    null
  );
}

/** New receipts consume their reservation; explicit edits retain their original identity. */
export function saveMockReceivingDocument(
  storage: MockStorage,
  data: Pick<SavedReceivingDocument, "header" | "items" | "note" | "signers">,
  now: Date = new Date(),
  options: { editingDocumentNo?: string; reservationToken?: string } = {},
): SavedReceivingDocument {
  const check = validateReceivingDraft(data.header, data.items);
  if (!check.valid)
    throw new Error(
      "ยังมีช่องกรอกไม่ครบหรือไม่ถูกต้อง กรุณาตรวจสอบข้อมูลก่อนบันทึก",
    );
  const state = readState(storage);
  const existing = state.documents.find(
    (doc) => doc.header.documentNo === data.header.documentNo,
  );
  const reservations = state.reservations ?? [];
  let nextReservations = reservations;
  if (options.editingDocumentNo !== undefined) {
    if (
      !existing ||
      options.editingDocumentNo !== data.header.documentNo ||
      existing.header.receiveDate !== data.header.receiveDate
    )
      throw new Error("การแก้ไขต้องใช้เลขเอกสารและวันที่รับเข้าเดิม");
  } else {
    if (existing)
      throw new Error("เลขเอกสารนี้ถูกใช้แล้ว กรุณาเปิดใบรับเดิมเพื่อแก้ไข");
    const reservation = reservations.find(
      (r) => r.documentNo === data.header.documentNo,
    );
    if (
      !reservation ||
      !options.reservationToken ||
      reservation.token !== options.reservationToken
    )
      throw new Error("กรุณายืนยันการจองเลข INB ก่อนบันทึก");
    if (reservation.status !== "reserved")
      throw new Error("เลขเอกสารนี้ถูกใช้แล้ว");
    if (Date.parse(reservation.expiresAt) <= now.getTime())
      throw new Error("เลขจองหมดอายุ กรุณาสร้างเลข INB และยืนยันใหม่");
    nextReservations = reservations.map((r) =>
      r.token === reservation.token ? { ...r, status: "used" as const } : r,
    );
  }
  const totals = calculateReceivingTotals(data.items);
  const saved: SavedReceivingDocument = {
    header: {
      ...data.header,
      qcDocumentNumbers: [...data.header.qcDocumentNumbers],
    },
    items: data.items.map((item) => ({ ...item })),
    note: data.note,
    signers: { ...data.signers },
    amountTotal: totals.amountDisplay,
    quantityByUnit: totals.quantities,
    savedAt: now.toISOString(),
  };
  const otherDocuments = state.documents.filter(
    (doc) => doc.header.documentNo !== saved.header.documentNo,
  );
  // One atomic write commits the receipt and used status; quota failures keep the previous JSON.
  storage.setItem(
    INB_MOCK_DOCUMENTS_KEY,
    JSON.stringify({
      ...state,
      version: 1,
      latestDocNo: saved.header.documentNo,
      documents: [...otherDocuments, saved],
      reservations: nextReservations,
    } satisfies DocumentState),
  );
  return saved;
}
