# PostgreSQL Backend Foundation — Phase 1

Status: **DEVELOPMENT FOUNDATION ONLY / MIGRATIONS NOT APPLIED / AUTH NOT IMPLEMENTED**.
This is not a production-ready system. No database connectivity is claimed until the local diagnostic is explicitly authorized and executed successfully.

## Verified local architecture

- Next.js App Router 16.4 / React 19 / strict TypeScript. Existing `app/(factory)/layout.tsx` composes MasterData, Mixing, Demo, PR, BOM, Inventory Operations, Production Quality and Packaging Providers. None are changed or connected to this backend.
- BOM has masters/formulas/components in `src/features/bom/bom-domain.ts`, with mock fixtures in `src/lib/mock-data/bom.ts` and in-memory `BOMProvider`. Existing draft/active/inactive labels are not production authorization or immutable release guarantees.
- `ProductionOrder` in `src/lib/mock-data/index.ts` represents Sales Hub/Datalink documents in DemoProvider. Bulk Production Orders use a separate local workspace. Neither currently contains authoritative formula/material snapshots.
- Material Requisitions have independent material and WIP rows and three signers; no approved Production Order linkage or stock deductions. Their mock state remains independent.
- Product pricing/SKU fixtures, BOM masters and inventory item fixtures have different identities. Physical Factory database ownership does **not** authorize a duplicate product/material/customer master. Mapping/ownership remains a later contract.
- Login explicitly supports direct Demo navigation, not a verified server session. No existing persistent API/database layer or migration runner was found. Client user/module settings are not RBAC.
- Receiving has its own INB reservation simulation; PR and other document numbering remain untouched. This foundation adds no business number generator.
- Existing inventory/schema and integration documents are proposals, not evidence of applied PostgreSQL tables. User-reported pgAdmin findings are not application connectivity verification.

## Scope and data owner

Factory owns its future factory-workflow persistence. Initial allowed target is exactly loopback `localhost` / `127.0.0.1` / `::1`, port 5432, database `ionflow_inventory_dev`, schema `inventory_sandbox`. This Phase 1 connector deliberately refuses `NODE_ENV=production` and other targets. Separate approval/security/configuration is required before supporting deployment or remote databases. IPv6/localhost resolution must reach the intended local PostgreSQL instance.

`src/server/database/` is marked `server-only`; import it only from trusted Node.js server code, never from client components, Edge runtime, public barrels or `use server` export files. `use server` creates remotely callable Server Functions; it is not the marker for an internal database utility. No Server Action or API endpoint is introduced.

## Dependencies and configuration

User approved `pg`, `server-only`, and development types `@types/pg`. Runtime pool creation is lazy; importing modules does not connect. One cached pool is reused per process/HMR; deployments with multiple processes would each need a pool budget. Configuration changes require process restart. Tests inject a fake pool and never contact PostgreSQL.

Copy `.env.example` to `.env.local` **manually**. Only the credential-free example is unignored by Git. No existing environment file is read/edited by this task. Fill `FACTORY_DB_PASSWORD` locally and enable `FACTORY_DB_ENABLED=true` only after approved role setup. Database/user/password/host/schema must be explicit; pool and timeout values have bounded defaults. No `DATABASE_URL`, `NEXT_PUBLIC_*` or `next.config.ts env` is used. Never log the parsed configuration or password.

`FACTORY_DB_USER=ionflow_factory_app` is a suggested role name, **not a role created by the app**. The `postgres` and reserved `pg_*` names are rejected. Administrator must approve and provision a dedicated LOGIN role without superuser, CREATEDB, CREATEROLE, REPLICATION or BYPASSRLS; audit role memberships/grants too. Application role must not own the database/schema/tables or have schema CREATE rights. A separate migration owner manages DDL. Phase 1 application role needs CONNECT and schema USAGE only; later table grants must be explicit and limited to approved repositories. No password/role/grant/server configuration is changed here.

The connector uses bounded pool/connect/idle/statement/query/lock timeouts. TLS is explicitly off only for the fixed loopback development target; do not reuse this policy for remote/production access. Error codes/messages and idle-pool logs are sanitized, without raw causes, SQL, query parameters or connection metadata.

## Query and transaction conventions

- Only read-only database methods are prepared: `query` wraps a checked-out client in `BEGIN READ ONLY` / COMMIT; `readOnly` supports several queries on the same client. Session also defaults to read-only.
- Search path starts with `pg_catalog`; read transactions explicitly set `pg_catalog, inventory_sandbox`. Fully qualify business tables in future repositories. Schema is a fixed identifier, never user SQL.
- SQL text is **trusted static server source**, never user input, even on a read-only method. Bind every value as `$1`, `$2`, etc. Do not expose generic SQL execution or accept SQL/identifiers from requests. This layer is not an SQL parser or a sandbox for hostile query text.
- Await every query inside the transaction callback. Do not issue transaction controls from callbacks or retain query handles after return; handles reject after transaction exit.
- On query/callback/commit failure, attempt ROLLBACK. Release clients in `finally`; destroy connections if rollback fails. Surface stable sanitized errors, not raw PostgreSQL failures. No automatic retries: future writes need validated idempotency keys and explicit retry policy.
- No writable transaction helper/business repository exists in Phase 1. Future mutation entry points must verify identity and authorization before repository access; atomically validate tenant ownership, persist document/snapshot/audit/idempotency records, then commit. Inventory posting ownership must remain singular. Do not retry a write when its commit outcome is unknown without idempotency reconciliation.

## Manual development diagnostic — NOT EXECUTED against a database

After separate authorization to execute read-only SQL and local role/config setup, use Node 24 (verified installed):

```text
node --conditions=react-server --experimental-strip-types --env-file=.env.local scripts/check-factory-database.mjs
```

The CLI opens a read-only transaction and verifies expected database, schema existence/USAGE, role safety flags and absence of schema/database CREATE privileges with a static, parameterized SELECT. It is not a complete role-membership/table-grant audit; an administrator still must review those permissions. It returns only PASS or a sanitized code; no username, database name or raw SQL error is printed. There is no public health endpoint. Failure is nonzero exit. Missing credentials/configuration are blocked checks, not connectivity failures proved by pgAdmin. The CLI does not load/execute migrations, create schema/roles, grant privileges or write business records. Pool is closed in `finally`.

Explicit `.ts` import extensions let the verified Node 24 runtime run developer tooling without a new loader/dependency. `tsconfig.json` enables `allowImportingTsExtensions` with existing `noEmit`; no existing UI imports or compiler strictness are changed.

## Migration preparation — separate from execution

Only `0001_foundation.up.sql` / `.down.sql` are prepared. They bootstrap `inventory_sandbox.schema_migrations` (version, SHA-256 checksum, applied timestamp and database actor). No schema/identity/tenant/product/material/BOM/order/stock table is invented. Absence of a schema or role is an administrator setup decision, not automatic DDL permission.

Manual plan after approval:

1. Inspect actual database/schema/role grants and confirm empty/current schema against the intended local instance. Do not assume user-reported results are still current.
2. Review static bootstrap SQL; compute/store its SHA-256 in the reviewed deployment record. Apply once as the migration owner inside its transaction, not as the app role. It deliberately fails if the table already exists rather than masking incompatible state with IF NOT EXISTS.
3. A later approved migration runner must hold a database advisory lock, reject changed checksums for an applied version, and record each successful migration with its checksum atomically. Do not build/run that runner in Phase 1. Bootstrap itself is recorded only once this metadata procedure is approved; do not insert a fake checksum.
4. Add compatible application code before enabling a future persistence mode; Demo remains the only UI mode now. Backfill only proven source identities/data, never inferred formula usage in historical orders.
5. Verify old documents remain readable and snapshots immutable; enable business mutations only after verified auth, scoped ownership, audit and idempotency tests.
6. Rollback application enablement first. Down migration only drops an empty migration ledger, refuses existing records, and never uses CASCADE. Never delete applied migration history or business data to force rollback. Review manual recovery for unexpected partial state.

No migration was executed; no migration tracking record, role or table was created.

## Authentication / tenant contract — pending, fail closed

`src/server/persistent-access.ts` always rejects persistent access with `AUTH_NOT_CONFIGURED`, including reads. It does not trust client role flags, headers, cookies, body tenant IDs or UI signers. `VerifiedFactoryActor` is only a future adapter contract, not proof of authentication. No new login/identity provider, session cookie or authorization endpoint is created.

Required decisions before replacing that denial:

- Approved existing identity issuer/service, signature/key validation, token audience/expiry/revocation and server session lifecycle. Do not assume iCON Firebase sessions are transferable to Factory.
- Authoritative organization/tenant membership and site scope, derived from verified server data. Client-requested tenant is only a selector validated against membership.
- Server-owned per-resource read/write/release permissions; read-only roles never gain writes. Define role-to-permission mapping and denial behavior independently of menu visibility.
- Immutable audit actor: verified subject + issuer, tenant/organization, action, timestamp, document identity and correlation/idempotency reference. Never take actor identity from editable signer fields.
- Tenant-aware keys/FKs, repository predicates, transaction scope and RLS design/tests (if selected). No global owner role or cross-tenant master duplication.

Until these contracts are approved and the real adapter is verified, no persistent business endpoints or writes may be exposed.

## Precision and units

- Current Inventory uses exact BigInt micro-units, boundary `NUMERIC(20,6)` and rejects excess precision without rounding; its number adapter rejects lossy round-trips. Do not modify those tested semantics in Phase 1.
- iCON reference schema has `NUMERIC(24,12)` BOM quantities; Factory BOM currently uses JS number mock quantities. Bulk quantities/sizes are primarily integer bags/kg; Material Requisitions have independently specified size/quantity/unit. None establishes a global precision/rounding rule.
- PostgreSQL NUMERIC values must remain decimal strings across future driver/API contracts; leave pg numeric parsing at its default (no `setTypeParser(..., parseFloat)`). Do not use JS floating-point for authoritative balances/scaling or silently trim twelve decimals to six.
- Before any formula→inventory boundary, approve overflow/range, intermediate precision and per-unit rounding policy, including ties and whether residual allocation is required; add boundary tests first. Current supported six-decimal behavior is exact rejection, not implicit rounding. No new rounding/conversion is implemented here.
- Unit labels (`KG`, `kg`, `กิโลกรัม`, `กก.`, bags, tons, counts) require an authoritative identity/alias/conversion contract. No name-based conversions or combined-unit quantity totals.

## Next phases — not implemented

2. Inventory: settle item/warehouse/Lot identity, migration baseline, precision, allocation/transaction/audit/idempotency ownership.
3. BOM: reuse current module/provider; confirm authoritative material/SKU mapping, release immutability and authorized persistence.
4. Orders: explicitly separate incoming Sales Hub/Datalink orders and internal Bulk production documents; approve the owner/milestone of immutable requirements snapshots.
5. Requisitions: consume the correct saved snapshot; prevent duplicate requests/physical movements rather than recalculate changing formulas or deduct inventory from document selection.

## Focused verification

```text
node --conditions=react-server --experimental-strip-types --test scripts/backend-foundation.unit.test.mjs
git diff --check
```

Tests use injected in-memory driver doubles for success/failure/rollback and diagnostic results, configuration validation, denied access, redaction, actual server-only package behavior and new-module semantic checks. No live SQL is involved. Provider/layout/navigation files are not changed; no mode-switch integration point exists to exercise. These checks do not prove live DB grants, Next.js production bundling, real authentication/RBAC/tenant isolation or business persistence. Full build/suite/global checks are intentionally out of scope.
