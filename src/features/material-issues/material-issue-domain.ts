
export const MATERIAL_ISSUE_LOCATIONS = [
  "โรงงานกาญ 2",
] as const;

export type MaterialIssueHeaderValues = {
  location: string;
  productName: string;
  quantity: string;
  issueDate: string;
  department: string;
};

export type MaterialIssueItem = {
  id: string;
  materialCode: string;
  materialName: string;
  quantity: string;
  unit: string;
  damagedQuantity: string;
  additionalQuantity: string;
};

export type MaterialIssueSignersValues = {
  requestedBy: string;
  issuedBy: string;
  inspectedBy: string;
};

export type MaterialIssueDraft = {
  header: MaterialIssueHeaderValues;
  items: MaterialIssueItem[];
  signers: MaterialIssueSignersValues;
};

export type MaterialIssueRecord =
  MaterialIssueDraft & {
    id: string;
    documentNo: string;
    version: string;
  };

export type MaterialIssueHistoryFilters = {
  search: string;
  dateFrom: string;
  dateTo: string;
};

export type MaterialIssueStockItem = {
  id: string;
  materialCode: string;
  materialName: string;
  unit: string;
  remainingQuantity: string;
};

export const EMPTY_MATERIAL_ISSUE_FILTERS:
  MaterialIssueHistoryFilters = {
    search: "",
    dateFrom: "",
    dateTo: "",
  };

export function filterMaterialIssueRecords(
  records: MaterialIssueRecord[],
  filters: MaterialIssueHistoryFilters,
): MaterialIssueRecord[] {
  const keyword = filters.search
    .trim()
    .toLowerCase();

  return records
    .filter((record) => {
      const searchableValues = [
        record.documentNo,
        record.header.location,
        record.header.productName,
        record.header.department,
        record.signers.requestedBy,
        record.signers.issuedBy,
        record.signers.inspectedBy,
        ...record.items.flatMap((item) => [
          item.materialCode,
          item.materialName,
        ]),
      ];

      const matchesSearch =
        !keyword ||
        searchableValues.some((value) =>
          value.toLowerCase().includes(keyword),
        );

      const matchesDateFrom =
        !filters.dateFrom ||
        record.header.issueDate >= filters.dateFrom;

      const matchesDateTo =
        !filters.dateTo ||
        record.header.issueDate <= filters.dateTo;

      return (
        matchesSearch &&
        matchesDateFrom &&
        matchesDateTo
      );
    })
    .sort((first, second) =>
      second.header.issueDate.localeCompare(
        first.header.issueDate,
      ),
    );
}

export function createEmptyMaterialIssueItem(
  id: string,
): MaterialIssueItem {
  return {
    id,
    materialCode: "",
    materialName: "",
    quantity: "",
    unit: "",
    damagedQuantity: "",
    additionalQuantity: "",
  };
}

export function createEmptyMaterialIssueDraft(): MaterialIssueDraft {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return {
    header: {
      location: "",
      productName: "",
      quantity: "",
      issueDate: today,
      department: "",
    },

    items: [
      createEmptyMaterialIssueItem("row-1"),
      createEmptyMaterialIssueItem("row-2"),
      createEmptyMaterialIssueItem("row-3"),
    ],

    signers: {
      requestedBy: "",
      issuedBy: "",
      inspectedBy: "",
    },
  };
}

export function hasMaterialIssueItemData(
  item: MaterialIssueItem,
): boolean {
  return [
    item.materialCode,
    item.materialName,
    item.quantity,
    item.unit,
    item.damagedQuantity,
    item.additionalQuantity,
  ].some((value) => value.trim() !== "");
}
