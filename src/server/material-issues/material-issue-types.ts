import type {
  MaterialIssueDraft,
  MaterialIssueRecord,
} from "../../features/material-issues/material-issue-domain";

export type {
  MaterialIssueDraft,
  MaterialIssueRecord,
};

export interface MaterialIssueInput {
  header: MaterialIssueDraft["header"];
  items: MaterialIssueDraft["items"];
  signers: MaterialIssueDraft["signers"];
}

export interface MaterialIssueHeaderRow {
  id: string;
  document_number: string;
  document_date: string;
  location_snapshot: string;
  product_name_snapshot: string;
  product_quantity: string | null;
  department_snapshot: string;
  requested_by: string;
  issued_by: string;
  inspected_by: string;
  version: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface MaterialIssueItemRow {
  id: string;
  material_issue_id: string;
  line_no: number;
  material_code_snapshot: string;
  material_name_snapshot: string;
  quantity: string;
  unit_snapshot: string;
  damaged_quantity: string | null;
  additional_quantity: string | null;
}

export type MaterialIssueAction =
  | "created"
  | "updated"
  | "archived";

export interface MaterialIssueHistoryRow {
  id: string;
  material_issue_id: string;
  record_version: string;
  action: MaterialIssueAction;
  actor_id: string;
  actor_display_name: string;
  occurred_at: string;
  note: string;
  changes: unknown[];
  request_id: string | null;
}

export interface MaterialIssueListFilters {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface MaterialIssueApiSuccess<T> {
  ok: true;
  data: T;
}

export interface MaterialIssueApiError {
  ok: false;
  message: string;
}

export type MaterialIssueApiResponse<T> =
  | MaterialIssueApiSuccess<T>
  | MaterialIssueApiError;