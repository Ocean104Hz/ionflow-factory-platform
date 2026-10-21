# Phase 2A — Identity, tenant and Inventory ownership

**PREPARED / ADAPTER INACTIVE / NO PERSISTENT BUSINESS WRITES.** Stop before Phase 2B.

## Identity evidence, not deployment assumptions

Factory's login is client Demo navigation. Factory layout mounts Demo/MasterData/BOM/Inventory Operations and other mock providers, without a server identity adapter. No Factory issuer/audience, verified token/session or authoritative tenant membership contract is configured. Client personnel/roles and editable document actors are not security principals.

iCON source uses Firebase Admin configured by project ID and applicationDefault credentials. Current login exchanges a Firebase ID token for a five-day **fb_session** cookie (HttpOnly, production Secure, SameSite Lax), with CSRF checks; auth_utils verifies that session with revocation checking. Logout revokes refresh tokens. UID is identity, with app_users/app_user_roles/roles providing local role membership (Admin, purchasing, warehouse, QC, production, dispatch). Current source differs from older docs describing __session; do not copy outdated cookie assumptions. No proven mapping from these app roles/users to Factory tenant/site permissions was found in the inspected boundary.

Sales Hub source uses Firebase/Identity Platform verifyIdToken(token, true), verified email and configured hubIdentityPlatformProjectId. It then resolves its own provisioned user profile and opaque hashed database sessions, expiry/revocation, active company and CSRF/origin checks. Current cookie is **__Host-ionflow-sales-hub-session**, with a legacy cookie accepted. SALES_USER is company-scoped; HUB_ADMIN has a distinct global scope. These are Hub permissions, not Factory inventory permissions.

Firebase SDK verification requires the approved project/issuer/audience and keys. No actual Factory issuer/audience values were read from secrets or invented. Candidate reuse is feasible architecturally but not approved/verified: do not transfer iCON/Hub cookies, use their database directly, treat company code/email as a tenant key, or confer Factory rights to Hub admins automatically.

## Inactive server authorization contract

`factory-authorization.ts` accepts **server-composed trusted adapters**, not browser-supplied verifiers. verifySession must cryptographically validate the agreed issuer/audience/algorithm/signature/key rotation, token times, current revocation and session/user status. The policy additionally checks configured issuer/audience, expiry, revocation flag and nonempty subject/session identity. Merely decoding a JWT is not verification. No adapter registration, SDK/dependency, cookie flow or endpoint is added. Test adapters are test doubles only.

Sequence: verify identity → freshly resolve authoritative membership by issuer+subject → match requested tenant AND organization → require active, unexpired membership → check requested sites and exact inventory.read/inventory.post permission → return immutable request-local context. Roles are audit/context metadata, not implicit grants; wildcard/admin bypass is unsupported. The context contains no credential. Audit actor is issuer+subject/session ID, not UI signer text.

Tenant/org/site selectors are untrusted. Returned membership must match them and identity exactly. No membership or lookup failure means denial. Context expires at the earlier session/membership cutoff and is runtime-recognized only in its issuing process; a plain object or serialized clone is not authority. Recheck identity/membership for every request; do not cache contexts across requests or treat expiry checks alone as revocation checks.

Inventory repository interface now requires AuthorizedFactoryContext. authorizedInventoryScope validates the read capability before producing scoped predicates. Mapper still takes validated DTO scope and is **not** an authorization verifier. A future repository must call this helper and include tenant, organization and allowed sites in every query/FK. No new query implementation is enabled. Existing requirePersistentAccess still always returns AUTH_NOT_CONFIGURED; readPersistentInventory still cannot invoke a repository.

## Ownership matrix

| Entity | Authority / stable identity | Read authority | Write authority | Existing integration / unresolved dependency |
|---|---|---|---|---|
| User identity | Existing approved Firebase/Identity Platform candidate; issuer + subject | Future verified Factory adapter | Identity provider, not Factory form | Exact project/audience, session policy, access to verification and revocation contract UNRESOLVED |
| Tenant/org/site membership | Authoritative membership service/table UNRESOLVED; immutable scoped IDs required | Future membership adapter | Approved membership administrator only | Hub company ID is not proven equivalent to Factory tenant/org/site |
| Product catalog | Hub source owns manufacturing_products UUID + company/factory scope; Factory has demo product.id/sku | Factory only through approved scoped integration | Hub owner for Hub products | iCON hub-products adapter exists; Factory live identity mapping and sync contract UNRESOLVED |
| Raw materials | iCON reference uses raw_materials.id/material_code/default_unit | Future authorized master adapter | Confirmed owning system, not an Inventory side effect | Factory inventory raw-a etc. and BOM masters have different IDs; live material owner/mapping UNRESOLVED |
| Formula/version | Factory direction approved; local BOM master.id/formula.id/version | Future scoped Factory formula service | Authorized Factory formula owner | Reconcile existing live iCON records before adoption; no duplicate import or formula changes here |
| Inventory item identity | Factory inventory identity links verified upstream system + master ID + tenant/org; code only display/reference | Authorized inventory readers | Approved mapping/master process | inventoryItems are fictional fixtures, not authoritative live masters; avoid one-record-per-matching-code inference |
| Warehouse/site | Factory owns factory-specific records; Settings MasterRow.id/parentId, Inventory warehouse.id/siteId | Authorized Factory site readers | Authorized Factory master-data maintainers | wh-1/wh-2 reused; east site/warehouse isolated demo; tenant/production baseline pending |
| Storage location | Factory owns; current exact locationLabel inside site/warehouse | Authorized warehouse/site readers | Approved Factory master process | No stable location ID yet; confirm migration mapping before introducing IDs |
| Lot/batch | Factory inventory lot reference; currently item + exact lotCode, no global ID | Authorized item/site readers | Approved Factory inventory workflow | Lot can span locations/warehouses/QC status. Global uniqueness or cross-system Lot equivalence UNRESOLVED |
| Units | Existing Settings unit records; Inventory baseUnit text | Authorized master/reference readers | Approved master owner | String aliases are not conversions; canonical unit-ID mapping pending |
| Stock events/balances | Factory owns ledger event/posting IDs and derived projections | Authorized scoped Inventory read | Future verified Factory posting owner | No physical movement owned by BOM selection, requisition save, invoice or preview |
| Incoming Production Orders | Sales Hub/Datalink origin and immutable external identity; local demo order.id/revision | Scoped document integration | Owning workflow, not inventory master | No authoritative formula snapshot/product mapping established by Factory demo |
| Material Requisition | Factory document.id, independent material/WIP row IDs | Authorized document readers | Document workflow owner | Current rows contain names/units, not verified inventory item links; no stock deduction implied |

## Current warehouse / Lot / quantity invariants

Item → base unit. Site → warehouse (InventoryWarehouse.siteId). A storage position is `(itemId, siteId, warehouseId, exact locationLabel, exact lotCode, inventoryStatus)`; proposed persistence prefixes tenant/org. Lots and locations are separate dimensions, not item names or QC states. Preserve empty Lot/location strings and case until a reviewed mapping says otherwise; do not infer distinct identities from spelling similarities.

Balances are replayed from immutable demo ledger events, not independently saved totals. Available status is QC-released demo quantity, **not ATP**. There is no reservation model/quantity. Transfers and QC status changes conserve quantities in their proper item/unit/Lot dimensions. Events apply atomically and replay must never leave a negative position; zero registry positions remain visible.

Existing quantity helpers use BigInt micro-units, exact NUMERIC(20,6), rejecting excess precision/overflow and lossy number round-trips. No rounding or unit conversion occurs. Unknown kg/ton/bag aliases are not automatically converted. No changes to these helpers or the Demo ledger are made.

## Proposed schema / additive migration gate

Extend the existing inventory-ledger-schema.md and inventory-persistence-preparation.md proposals, not a second database model. After ownership approval: tenant/org-scoped item reference links to verified authoritative master IDs; scoped Factory warehouse/location references; item-scoped Lot refs; full-key unique positions; immutable ledger events/postings; derived checkpoint/balance projection only if justified by read volume; verified actor/session and timestamps/idempotency audit metadata.

All child FKs must include tenant/org and parent identity, warehouse–site, location–warehouse, Lot–item and item–unit relationships. External authoritative master IDs cannot use cross-database FKs: use approved validated reference links, no direct cross-database writes. Tenant/org keys must come from the chosen authoritative service, not speculative tenant tables.

DDL remains deferred: no safe exact FK targets or membership owner yet. Existing 0001 tracking migration remains prepared, not applied. Prepare additive up/down SQL only after these contracts are approved; apply under separate migration-owner authorization. One transaction must persist event, postings, projection, audit and idempotency outcome; deterministic stock-key locks and chronological replay validation remain required. No ordinary runtime update/delete of posted history. Read snapshots require consistent revision/isolation. Backfill only proven mappings/opening evidence, never invented historical ownership.

Rollback disables persistent mode first, preserves events/audit/migration history, and keeps Demo compatible. Only reviewed empty new structures can be removed without CASCADE. Populated structures need forward repair/export/recovery, not deleting historical data. No migration is run in Phase 2A.

## Isolation review and separate DBA approval

Latest live check before this task reported TEMP on ionflow_inventory_dev, USAGE of public and CONNECT to two other databases via PUBLIC; connection succeeded as factory_readonly. This task does not rerun live SQL or connect elsewhere. These are known unresolved findings, not a new complete privilege audit.

TEMP can permit temporary objects and resource consumption even though sandbox permanent CREATE is denied; read-only session options are not a substitute for ACLs. Other-schema USAGE permits resolving accessible objects/functions but is not itself proof of table writes. PUBLIC CONNECT means an application config allowlist does not enforce cluster-level connection isolation.

Separate DBA plan: inventory effective grants/default ACLs/memberships and all dependent apps; consider a dedicated development cluster if global PUBLIC changes are unsafe. On the authorized database, review removal of PUBLIC TEMP/unused schema USAGE and explicit grants for legitimate roles only. Denying this role other-database PUBLIC CONNECT cannot be achieved by revoking only its direct grant: PostgreSQL has no per-role DENY. Any change to other-database ACLs is outside this task and requires their owners' approval. Do not revoke PUBLIC globally or change other roles here. Keep readonly, future writer and migration owner separate; no object-owning/admin runtime role.

## Phase 2B prerequisites

Approve the reusable issuer/project/audience and session verification contract, membership owner and tenant/org/site IDs; provision verified adapters without trusting frontend claims; approve product/material ID mappings and unit/location/Lot baseline; resolve database isolation; review additive SQL and write-role privileges separately. Test real issuer/revocation/membership and transaction concurrency before any persistent enablement. No production readiness claim.

## Exact inspection manifest

Factory (relative to ionflow-factory-platform): AGENTS.md; package.json; src/features/login/login.tsx; app/(factory)/layout.tsx; src/components/factory/demo-provider.tsx; src/lib/mock-data/index.ts; src/lib/mock-data/inventory.ts; src/features/products/products.tsx; src/features/master-data/master-domain.ts; src/features/bom/bom-domain.ts; src/features/material-requisitions/material-requisition-domain.ts; src/features/inventory/inventory-domain.ts; inventory-ledger-domain.ts and inventory-quantity.ts in that same directory; src/server/persistent-access.ts; src/server/inventory/inventory-repository.ts; scripts/backend-foundation.unit.test.mjs; docs/inventory-persistence-preparation.md; bundled Next use-server.md. Production-order-detail.tsx was searched for reference fields only. No secrets/env files read.

iCON (read-only): AGENTS.md; docs/PROJECT_CONTEXT.md; app/lib/auth_utils.ts; app/lib/firebase_admin.ts; lib/firebase/firebase_admin.ts; app/lib/data.ts (role/identity search); app/api/auth/login/route.ts; app/api/auth/logout/route.ts (session/revocation search); app/api/bom-formulas/raw-materials/route.ts; app/api/hub-products/route.ts.

Sales Hub (read-only): AGENTS.md; src/server/auth/identity-platform.ts; tenant.ts; authorization.ts; session.ts; request-security.ts in that directory; src/server/manufacturing-products/products.ts. Source excerpts, not live databases or configuration secrets, establish these findings.
