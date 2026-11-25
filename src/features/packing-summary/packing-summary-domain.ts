import type { PackagingReport } from "../packaging-reports/packaging-domain.ts";

export type PackingItem = {
  id: string;
  productName: string;
  sizeKg: string;
  quantity: string;
  unit: string;
  remark: string;
};

export type PackingSummary = {
  id: string;
  location: string;
  date: string;
  documentNo: string;
  items: PackingItem[];
  signers: { packer: string; supervisor: string; packingHead: string; approver: string };
  reportIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PackingReportOption = Pick<PackagingReport, "id" | "documentNumber" | "status" | "documentDate"> & {
  linkedSummaryId: string | null;
};

export type PackingSummaryData = { records: PackingSummary[]; reports: PackingReportOption[] };
