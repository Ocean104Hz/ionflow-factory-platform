# Inventory PostgreSQL preparation

Status: **CONTRACTS PREPARED / DEMO ACTIVE / BUSINESS DDL AND WRITES BLOCKED**.

## Verified flow and ownership

- InventoryOperationsProvider owns an in-memory createStockSession. Commands replace demo ledger events atomically; replayLedger projects balances. No database implementation is wired to the provider/UI.
- One item model supports six canonical types and unmapped legacy classification. QC states AVAILABLE/QC_HOLD/BLOCKED are independent. Stock key is item/site/warehouse/locationLabel/Lot/status; zero positions remain registered.
- Inventory reuses Settings wh-1/wh-2 at site-demo; east site/warehouse are isolated demo fixtures. This does not establish production mappings.
- BOM owns separate master/material IDs and numeric mock components. Material Requisitions own independent material/WIP rows without approved inventory or Production Order snapshot links. Integration Preview is read-only, not a posting source.
- Factory owns future workflow persistence, not duplicate material/product/warehouse masters. Resolve Settings/BOM/SKU/unit ownership and location/Lot identity mappings before defining FKs or backfilling.

## Live verification (2026-10-21)

Existing diagnostic and read-only catalog checks PASS at localhost:5432 / ionflow_inventory_dev / inventory_sandbox. Current and authenticated role: factory_readonly. Transaction read-only on; schema exists with zero application tables, schema CREATE denied.

Strict isolation remains incomplete: effective TEMP, one other usable application schema and CONNECT to two other databases. Prior verification identified PUBLIC grants. Only catalogs inside the authorized database were read; no other database was connected. Application target restrictions do not replace ACL isolation. DBA must review effects on other apps before any PUBLIC changes; none are made here.

## Executable boundary

The server-only inventory-repository module defines an exact decimal balance DTO, typed read repository and scoped row mapper. Row names are proposed DTO fields, NOT existing SQL columns. Mapper checks tenant/organization/site, resolved item/warehouse/site relationship, base unit, QC status, quantity and timestamp. Supplied references must themselves be authorized in the same tenant; global mock arrays do not establish authorization.

NUMERIC remains decimal text. Existing BigInt NUMERIC(20,6) helpers reject excess precision, overflow, exponent notation and lossy number coercion; no rounding or conversion. Negative signed postings are distinct from nonnegative projected balances. BOM's potential twelve-decimal boundary needs separately approved rounding/rejection rules. No mixed-unit sums or changes to historical base units.

Persistent reads call the existing fail-closed server identity guard. Even after identity is implemented, storage/site approval is required before repository invocation. No business SQL, writable repository, API, Server Action, provider, write connection or mode switch is introduced against absent tables.

## Additive migration plan — physical DDL deferred / NOT APPLIED

Existing 0001 prepares migration tracking only. New executable business migrations are deferred because tenant identity, master ownership and location/Lot mapping are unresolved. The existing inventory-ledger-schema.md is a proposal, not an approved physical contract. Do not create speculative master/tenant tables to unblock DDL.

After approval, prepare reviewed additive SQL for:

1. Scoped references to authoritative item/site/warehouse/unit records, without duplicate masters; explicit unmapped classification.
2. Stable locations/Lots and positions; full scoped stock-key uniqueness including zero positions. Preserve text/case and define absent Lot uniqueness.
3. Immutable event headers: stable ID, tenant/organization, event type, posted timestamp, deterministic order, reference/reason, recorded timestamp and verified issuer/subject audit actor.
4. Nonzero signed NUMERIC(20,6) postings with scoped composite event/position FKs. Row CHECKs alone cannot enforce chronological nonnegative replay or cross-row conservation.
5. Tenant/source-action idempotency uniqueness and canonical payload fingerprint. Same key/different payload conflicts; exactly one owner per physical movement.
6. Derived balance/checkpoint projection, not an editable stock source; stock-key, tenant/event-order and document-history indexes.
7. Approved opening evidence/checksum/cutoff. Never import both snapshots and opening quantities; demo synthetic history is not production provenance.

Execution requires separate approval and migration-owner access. Record reviewed checksums under a migration lock; do not fabricate migration history. Exact business DDL cannot safely be approved before ownership decisions above.

## Security / transaction contract — pending

Approve identity issuer/audience/signature/session validation, verified tenant/org membership, allowed sites and server-owned inventory.read / inventory.post permissions. Editable signers/demo actors are not audit identity. Current requirePersistentAccess denies persistent reads/writes; no authentication provider is invented.

Proposed factory_inventory_writer (NOT CREATED) must be separate from factory_readonly/migration owner, without ownership, CREATE or admin flags. Grant only reviewed posting/projection operations after security approval; runtime must not mutate posted history. No automatic GRANT/REVOKE/role setup.

Future posting transaction: authorize actor/scope; lock stock keys in deterministic order; check idempotency/payload; validate references, units, chronological stock including backdating and transfer/status conservation; atomically persist event, all postings, derived projection, audit and idempotent outcome; commit once. Roll back all on error. Unknown commit outcomes require idempotency lookup, not blind retries. Read snapshots require one consistent database revision/isolation level, not independent READ COMMITTED queries. Demo commit logic is not a server transaction.

## Rollout / rollback

Approve identity/mapping/isolation, then review exact SQL and down SQL separately. Apply only after explicit development migration approval. Backfill only proven identities/opening evidence and reconcile every stock key exactly. Enable persistence only after focused security/transaction tests; Demo remains active now.

Disable persistent mode before rollback; preserve ledger/audit/migration history. Only empty new structures may be removed by a reviewed down migration without CASCADE. Populated structures require a data-preserving recovery plan, not automatic deletion. No DDL or rollback SQL is executed here.
