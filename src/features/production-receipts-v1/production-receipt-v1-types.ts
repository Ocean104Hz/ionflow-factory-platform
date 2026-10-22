export type ReceiptItemV1 = {
  id: string;
  name: string;
  sizeKg: string;
  quantity: string;
  unit: string;
  lot: string;
  note: string;
};

export type ReceiptDocumentV1 = {
  location: string;
  documentDate: string;
  documentNumber: string;
  productionOrderNumber: string;
  items: ReceiptItemV1[];
  p1Total: string;
  p2Total: string;
  moldingTotal: string;
  warehouseOfficer: string;
  inspector: string;
  note: string;
};

export function newReceiptItemV1(): ReceiptItemV1 {
  return {
    id: crypto.randomUUID(),
    name: "",
    sizeKg: "",
    quantity: "",
    unit: "กระสอบ",
    lot: "",
    note: "",
  };
}

export function newReceiptDocumentV1(): ReceiptDocumentV1 {
  return {
    location: "",
    documentDate: new Date().toLocaleDateString("en-CA"),
    documentNumber: "",
    productionOrderNumber: "",
    items: [newReceiptItemV1()],
    p1Total: "",
    p2Total: "",
    moldingTotal: "",
    warehouseOfficer: "",
    inspector: "",
    note: "",
  };
}
