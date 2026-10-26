# Maintenance UI V1

Routes: `/repair-requests`, `/repair-requests/new`, `/repair-requests/[repairRequestId]`, `/equipment`, `/equipment/[equipmentId]`, `/maintenance-reports`.

`repair-store.ts` is the only maintenance state source: a module-scoped immutable store observed with React `useSyncExternalStore`. It survives client-side navigation without changing Factory layout/providers. Server rendering uses deterministic initial fixtures; browser reload resets the demo. No localStorage, APIs, database access, or production authorization. Drafts receive a local number on save so they remain uniquely identifiable; submitting a draft retains its ID and number. An unsaved request displays no assigned number.

Equipment comes read-only from the existing `MasterDataProvider` and `MasterRow` contract. `equipmentAdapter` resolves `parentId` ancestry for site/line/location, and never makes up a missing type/location. This is the existing Demo Master, not PostgreSQL Settings. No new equipment catalog or CRUD. Six fictional requests reference the actual existing demo equipment ID.

## Form coverage

- Document: read-only number; editable date, requester, department, site, area/line.
- Equipment: selectable existing active ID; code/name/location/type shown from that exact master record.
- Problem: title, category, description, priority, stopped flag, detection timestamp, up to five local photo previews.
- Additional: remarks, requested repair date, separate notes.
- Work log: technician, receipt timestamp; editable diagnosis, method, start/end, technician notes; independent spare rows (name/quantity/unit/unit cost), labor and exact two-decimal total.
- Detail includes every saved field and attached photos; activities preserve each transition and log save. Closed/cancelled requests have no mutation actions.

Draft permits incomplete content but requires a valid request date and title; submitting validates all marked fields. Photos are PNG/JPEG/WebP, ≤5 MB each, only object URLs in the current tab. No uploads. Browser Back cannot be intercepted reliably without changing shared routing; explicit Cancel/link navigation and reload show discard warnings. Work-log tab changes should be saved explicitly.

Workflow is centralized in `transitions`. Receipt is a separate timestamped action while ASSIGNED; starting requires receipt. SUBMITTED→PENDING_ASSIGNMENT is explicit. Rework and cancellation require a reason; inspection requires diagnosis/method. No production roles, approvals, or notifications.

Reports derive from the same requests and filters. Completed includes COMPLETED/CLOSED. Open excludes DRAFT/CANCELLED/COMPLETED/CLOSED. Downtime is explicitly an approximate request-duration total, not OEE: detection→work end/current report timestamp for stopped requests; overlapping requests may overlap in time.

## Future API boundary (not implemented)

Replace the store adapter with authorized list/detail/create/draft-update/work-log/transition operations. Preserve stable request ID, equipment Master ID, immutable activities, status preconditions, and add server versions/idempotency. Resolve the authoritative Equipment/Personnel source and tenant context before connecting. Uploading photos requires a separately authorized attachment service. Parts are free-form estimates only, never Inventory transactions. No runtime endpoint or schema is created in V1.

Print preview is not provided in V1 (optional in the brief). No physical printing, persistence across reload, live master synchronization, or role enforcement is claimed.
