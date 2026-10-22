
export type ReceiptGroupV1 = "P1" | "P2" | "MOLDING";

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

  p1Items: ReceiptItemV1[];
  p2Items: ReceiptItemV1[];
  moldingItems: ReceiptItemV1[];

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

    p1Items: [newReceiptItemV1()],
    p2Items: [newReceiptItemV1()],
    moldingItems: [newReceiptItemV1()],

    warehouseOfficer: "",
    inspector: "",
    note: "",
  };
}
