# Production Orders: local PostgreSQL

## Scope and current verification

`/production-orders` is the existing Sales Hub / Datalink order view, not the
independent `/bulk-production-orders` document. Existing order fields, source IDs,
source revision and source references are preserved. The new editor records
explicitly entered local data; selecting a source is not proof of upstream origin.
No existing mock records are silently seeded, imported, or converted to real orders.

Implementation: dedicated repository, loopback API, route-scoped provider, local
create/edit/archive, optimistic record versions, append-only local audit events.
There is no mock fallback when the API/database fails. The global DemoProvider and
other modules remain unchanged. Existing mock invoices/deliveries are not live
relationships to PostgreSQL orders.

Verified locally on 2026-10-21: dedicated role creation, migration 0003, real
PostgreSQL CRUD/archive, duplicate and stale-version rejection, API-process restart
persistence and browser create/edit/reload/archive all **PASS**. The authenticated
database was `ionflow_inventory_dev`, schema `inventory_sandbox`, role
`factory_production_writer`. The temporary setup-admin variable was removed from
the ignored local environment file after setup. See the execution record below;
test-double unit checks alone are not evidence of a live connection.

## Configuration and setup

Only `localhost:5432/ionflow_inventory_dev`, schema `inventory_sandbox`, is accepted.
The runtime requires `NODE_ENV=development`, existing `FACTORY_DB_*` target values,
`FACTORY_PRODUCTION_ENABLED=true`, `FACTORY_PRODUCTION_DB_USER=factory_production_writer`,
`FACTORY_PRODUCTION_DB_PASSWORD`, and `FACTORY_PRODUCTION_APP_ORIGIN` (default
`http://localhost:3000`). All credentials stay server-side in ignored `.env.local`.

For authorized first setup only, the user supplies the administrator password as
`FACTORY_SETUP_ADMIN_PASSWORD` in `.env.local`, not in chat or command arguments.
Run `node scripts/setup-production-orders-local.mjs`. It checks the actual local
session before schema work, refuses existing roles/tables rather than resetting
credentials, and runs migration/grants in one transaction. It generates a separate
runtime password, stages configuration with a restrictive Windows ACL, checks for
concurrent file edits, commits, then atomically replaces the local file. The
temporary administrator variable is removed. If commit succeeds but the rename
fails, retain the reported protected recovery file; do not recreate/reset the role.

The dedicated role receives CONNECT, sandbox USAGE, SELECT/INSERT/UPDATE on
`production_orders`, and SELECT/INSERT on `production_order_history` only. No role
memberships, ownership, CREATE, DELETE, TRUNCATE or administrative privileges are
granted. Settings/read-only roles are not changed. Previously reported PUBLIC
TEMP/other-schema/database grants remain a separate isolation issue; this setup
does not revoke cluster-wide privileges or claim cluster-wide isolation.

Run the API separately from Next and Settings:

```powershell
$env:NODE_ENV='development'
node --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/production-orders-local-server.mjs
```

It binds **127.0.0.1:4318 only**. Every request requires the actual loopback socket,
exact Host and configured Origin, opt-in development mode and no proxy headers.
There are no Next/public write endpoints and no global authentication bypass.
This is a single-machine development access boundary, not production identity,
tenant authorization, or verified QA approval.

## Tables, transactions and rollback

`0003_production_orders.up.sql` creates only:

- `inventory_sandbox.production_orders`: existing complete order payload, stable ID,
  unique `(source, company, number)`, independent optimistic record version,
  creation/update time and archive marker.
- `inventory_sandbox.production_order_history`: local actor, record version,
  timestamp and action description/reason. The sole FK points to the order table
  created by this migration; there are no speculative foreign keys.

Source revision is not reused as local record version. Source identity/references
cannot be changed by editing. Reads use a consistent read-only snapshot. Writes
serialize within this module, check expected versions, update the order and audit
event atomically, and roll back together. Retrying creation with the same ID or
document identity conflicts rather than duplicating it. Archive is the supported
delete operation for unstarted orders; identities/history and document uniqueness
remain reserved. Started orders cannot be archived by this API.

Rollback: stop only this API, preserve existing rows and a backup, then review
`0003_production_orders.down.sql` manually. It refuses rollback if either table
contains any record (including archived records). Never run down automatically,
delete historical records to force rollback, or use CASCADE.

## Future integration contracts

Contracts live in `production-order-integrations.ts`; they are deliberately
inactive types, not placeholder implementations or claims of verified mappings.

| Integration | Boundary / expected data | Status and decision required |
|---|---|---|
| Settings warehouse | `resolveWarehouse(order)` returns a verified `MasterSnapshot` or explicit `UNRESOLVED` | Contract ready; warehouse label is not a Settings ID. Confirm authoritative mapping and tenant scope before connecting. |
| Inventory item | `resolveItem(source, sku)` returns item ID/code/base unit or `UNRESOLVED` | Contract ready; matching SKU text alone does not establish identity. No balances or movement command. |
| BOM | `eligibleFormulas(productMasterId)` returns formula ID/code/version/batch size/unit | Contract ready; active eligibility, product ownership, unit rules and approval authority must be verified server-side first. |
| Material Requisitions | `readApprovedRequirements(orderId, recordVersion)` returns a PO-owned immutable requirements snapshot or `UNRESOLVED` | Shape ready; snapshot persistence/publication and authorized approval point are deferred. Do not recalculate from changing BOM data. |
| Bulk Production Orders | No verified existing dependency | Separate module; no adapter, FK, or automatic linkage added. Requires an explicit business mapping decision. |

The snapshot contract uses decimal strings for material requirements; it does not
perform stock arithmetic using existing UI `number` quantities. Existing UI number
semantics are retained only for entered/displayed order quantities and prices.
Exact material precision, validated conversions and rounding remain future domain
decisions, not implicit changes in this migration.

Existing optional source references (`salesOrder`, `customerCode`, warehouse label)
may remain blank because the current domain permits them. SKU/name/unit and
positive item quantity remain required. No invented master IDs, related records,
formula usage or historical snapshots are saved. All resolutions must come from
trusted server-owned adapters; browser-supplied IDs must never become verified
references on their own. Schema/API evolution must preserve unresolved historical
orders. Unknown future reference fields are not currently supported by this API.

Contact, recipient, attachment, driver and verified approver data do not exist in
the current order contract; the detail page displays absence rather than fabricated
records. Upstream ingestion/cancellation requests remain deferred. Existing saved
cancellation data can be displayed, but local entry cannot create a fake upstream
request. Status changes are local tracking only, with no stock issue/receipt,
requisition creation, Sales Hub write, or workflow approval integration.

## Focused verification

```powershell
node --conditions=react-server --experimental-strip-types --test scripts/production-orders-postgres.unit.test.mjs
```

Includes parser/date/status checks, IDs/reference immutability, transitions,
multi-item fidelity, transactional repository behavior using a test double,
duplicate/stale conflicts, audit rollback, redaction, exact targets and local access.
The field-manifest structural check and changed-file TypeScript check are **not**
rendered UI verification. No full suite/build/global lint/typecheck is required.

After provisioning, stop only an agent-owned Production API on 4318 before running
the real integration verifier (it starts/restarts its own server, never kills an
unrelated process):

```powershell
$env:NODE_ENV='development'
$env:FACTORY_PRODUCTION_LIVE_TEST='true'
node --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/production-orders-postgres.live.mjs
```

It authenticates as the dedicated writer, verifies target/permissions, creates one
unique clearly labelled TEST order with two items, checks read/update/duplicate and
stale failures, verifies reload and API-process restart persistence, then archives
only its own test record. Audit/tombstone remain; no hard deletion of user records.
The restart check does not claim a full Next application restart or browser test.
Failures retain the test identity for explicit recovery; no user records are used.

Before deployment: verified production authentication and tenant authorization,
audit actor identity, trusted upstream contracts, privilege isolation, database
backup/migration ownership and deployment-specific API transport are still required.

## Local execution record — 2026-10-21

- `node scripts/setup-production-orders-local.mjs`: PASS. Created the dedicated
  role and both Settings-independent tables; additive migration committed. No down
  migration or unrelated schema/table changes were executed.
- With `NODE_ENV=development` and `FACTORY_PRODUCTION_LIVE_TEST=true`,
  `node --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/production-orders-postgres.live.mjs`:
  PASS. Repeated once after adding an explicit upstream-cancellation guard check.
  Both runs verified actual authentication/target/role flags, required table
  permissions and denied destructive privileges. Create/read/update/archive,
  duplicate rejection, stale version conflict and API restart persistence passed.
- `node --conditions=react-server --experimental-strip-types --test scripts/production-orders-postgres.unit.test.mjs`:
  11 selected tests, 11 PASS after the scoped dialog fix, including changed-file
  TypeScript checks. No global typecheck, build or full test suite was run.
- Browser `http://localhost:3000/production-orders`: created
  `BROWSER-TEST-20261021-A` with two independent items; changed only the second
  quantity from 4 to 7 and the document note. Both item notes and the first quantity
  2.5 remained intact. Reload, Production API stop/start and another browser reload
  preserved the changes. Canceling the confirmation dialog left the document
  present; confirming archive removed only that test document from the active list.
- The browser exposed an inherited shared-dialog caption claiming demo-only state.
  Fixed only the Production Orders dialog adapter: truthful PostgreSQL Local text,
  async error retention and cancel action, using existing shadcn primitives. Shared
  dialogs/layout and other module files were not changed.
- A final read-only SQL check authenticated as `factory_production_writer` and
  verified all three test records archived, the browser row values/note preserved,
  and nine audit events retained. No hard deletion; those TEST tombstones/history
  intentionally remain. Test IDs:
  `po-live-24433211-d61f-4d36-970c-b8496e3ee172`,
  `po-live-9ad34420-19f1-4613-8ea0-cab61d4ef810`,
  `f9c7ef7b-5b2d-4ad0-b13f-5cff3ffebd3d`.
- Files changed in this completion run: ignored `.env.local` (protected setup),
  `scripts/production-orders-postgres.live.mjs`,
  `scripts/production-orders-postgres.unit.test.mjs`,
  `src/features/production-orders/production-order-form-dialog.tsx`,
  `src/features/production-orders/production-order-detail.tsx`, and this document.
  Existing unrelated working changes were preserved.
- Still deferred: genuine upstream cancellation ingestion/decision integration
  (a local order cannot fabricate an upstream request), production authentication,
  tenant authorization, and cross-module integrations described above. Local archive
  is not a Sales Hub/Datalink cancellation. Restart verification covered the API
  process, not PostgreSQL service or the existing shared Next development process.
  No production deployment, commit, push or database-service restart was performed.

Suggested commit (not created): `feat(production): enable local PostgreSQL orders`.
