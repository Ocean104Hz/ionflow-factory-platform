# Factory Auth Migration — Isolated PostgreSQL 18 Validation Runbook

สถานะ: **PREPARED / NOT EXECUTED / APPROVAL REQUIRED**

เอกสารนี้เริ่มจาก Phase 2.7 และอัปเดตถึง Phase 2.9A ให้สอดคล้องกับ validation harness สำหรับตรวจ `0005_factory_auth` ใน PostgreSQL disposable เท่านั้น มีการรันเฉพาะ static plan/unit test; ยังไม่มีการ connect หรือ execute SQL และห้ามใช้กับ `ionflow_inventory_dev` ตัวจริง

## 1. Scope และ approval boundary

ตรวจเฉพาะ:

- `migrations/0001_foundation.up.sql`
- `migrations/0005_factory_auth.up.sql`
- `migrations/0005_factory_auth.down.sql`
- constraint, FK, index, ACL, transaction, ledger และ rollback behavior ของ Auth

ไม่ตรวจหรือเปลี่ยน Settings, Production Orders, Bulk Production, Inventory, Login, Firebase, role หรือข้อมูลจริง

ก่อน provision/connect/execute ต้องได้รับอนุมัติใหม่ที่ระบุ:

1. disposable technology/host ที่ใช้
2. exact endpoint และ database name
3. validation-only target-guard strategy
4. image/package version และ source
5. migration owner/credential delivery mechanism
6. cleanup owner และหลักฐานหลัง cleanup

## 2. Intended disposable target

ค่าที่ต้องการ:

| Field | Required value |
|---|---|
| Purpose | `IONFLOW_FACTORY_AUTH_VALIDATION_ONLY` |
| PostgreSQL | 18.x; prefer exact 18.6 image/package digest |
| Client endpoint | `127.0.0.1:55432` |
| Database | `ionflow_factory_auth_validation` |
| Schema | `inventory_sandbox` ใน disposable database เท่านั้น |
| Owner | `factory_auth_validation_owner` แบบ disposable |
| Storage | fresh ephemeral volume; ห้าม mount host PostgreSQL data directory |
| Network | loopback publish only; no host network; no cloud/shared network |
| Secrets | random per run, protected input/secret store, never CLI/Git/log |
| Business data | none |

Environment ต้องไม่อ่านหรือ mount `.env.local`, Factory business credentials, production certificates หรือ cloud configuration

### Validation-only guard adaptation

`0005_factory_auth.up.sql` และ down file ต้นฉบับยังยอมรับเฉพาะ `current_database()='ionflow_inventory_dev'` และ server-side port `5432` ไฟล์เหล่านี้ต้องคงเดิมแบบ byte-for-byte

Phase 2.9A ทำ validation-only derivative ใน memory โดยเปลี่ยนแบบ exact-match เพียงสอง predicate ต่อไฟล์:

- `current_database() <> 'ionflow_inventory_dev'` เป็น `current_database() <> 'ionflow_factory_auth_validation'`
- `inet_server_port() <> 5432` เป็น `inet_server_port() <> 55432`

แต่ละ source predicate ต้องพบหนึ่งครั้งและ validation predicate ต้องยังไม่ปรากฏก่อน transform หาก source checksum, guard ใดหายไป, ซ้ำ หรือมี SQL เปลี่ยนโดยไม่ review harness จะหยุดทันที `inet_server_addr()` loopback guard ไม่ถูกเปลี่ยน

Derived SQL ห้ามเขียนทับ source, ห้าม commit และไม่ถือเป็น migration สำหรับ actual database

Approved checksums หลัง Phase 2.9A:

| File | Source SHA-256 | Derived SHA-256 |
|---|---|---|
| `0005_factory_auth.up.sql` | `7ef8f18c1a3fcd75625692f81788ac541741780d2754bf8d88ce560ccf4377c3` | `8af3e7793f79f0f40f53e7c2f452f364818ac0250982ccb4110e899e1af7f4c2` |
| `0005_factory_auth.down.sql` | `1651bf2922acdccb72fa039d0b28bd2b9beca2c3abb072761b59be19a7b03d1e` | `99666b67673a631d0db98203f7ade840eb0ee561d728b211c88e3afb80291248` |

Disposable PostgreSQL ต้อง bind ที่ `127.0.0.1:55432` ทำให้ทั้ง client target, `inet_server_addr()` และ `inet_server_port()` ตรงกัน Standard container bridge address ยังคงถูกปฏิเสธตามตั้งใจ

## 3. Local tooling status

ตรวจ command discovery แบบ read-only แล้ว:

| Tool | Status |
|---|---|
| Docker CLI | ไม่พบใน PATH |
| Podman CLI | ไม่พบใน PATH |
| PostgreSQL 18.6 binaries | พบที่ `C:\Program Files\PostgreSQL\18\bin`; ไม่อยู่ใน PATH |
| `initdb`, `pg_ctl`, `psql`, `pg_isready` | พบใน PostgreSQL 18.6 bin directory |
| Node.js + repository `pg` package | มี; Phase 2.9A harness พร้อม แต่ PostgreSQL execution ยัง NOT RUN |

กลยุทธ์ที่รองรับคือ dedicated local PostgreSQL 18 cluster ด้วย data directory ใหม่และพอร์ต 55432 ห้ามใช้ data directory/service/port 5432 ของ Factory เดิม คำสั่ง provision/psql ทั้งหมดยังเป็น **TO CONFIRM** และห้ามติดตั้ง dependency ในงานนี้

## 4. Isolation preflight

Approved harness ต้อง fail closed ก่อน DDL หากข้อใดข้อหนึ่งไม่จริง:

1. Client target เท่ากับ `127.0.0.1:55432` แบบ exact; ปฏิเสธ port `5432`, `localhost` ที่ resolve ไม่แน่นอน, Unix socket, cloud hostname และ connection URL
2. Database เท่ากับ `ionflow_factory_auth_validation`; ปฏิเสธ `ionflow_inventory_dev`
3. Server identity รายงาน `inet_server_addr()='127.0.0.1'`, `inet_server_port()=55432` และ version major เท่ากับ 18

Harness อ่าน server address ด้วย `pg_catalog.host(inet_server_addr())` แล้ว จึงเปรียบเทียบ host address โดยไม่มี inet netmask suffix; regression test ครอบคลุมและ preflight false-negative เดิมถือว่าแก้แล้ว
4. Database comment/marker เท่ากับ `IONFLOW_FACTORY_AUTH_VALIDATION_ONLY:<approved-run-id>`
5. Current role เท่ากับ `factory_auth_validation_owner`, ไม่มี superuser/CREATEROLE/CREATEDB/REPLICATION/BYPASSRLS และไม่มี inherited/direct role membership อื่น ยกเว้น implicit `pg_database_owner` ของ disposable database
6. Schema owner เป็น validation owner และ schema ไม่มี object ก่อน setup
7. Catalog ไม่มี `settings_masters`, Production, Bulk, Inventory หรือ business tables
8. Approved source SHA-256 ของ 0005 ตรงกับไฟล์ review; derived copy ต่างเฉพาะ database และ port guard ที่อนุมัติ
9. Migration process ไม่โหลด `.env.local` และไม่มี Factory application credentials
10. Separate process obtains advisory lock for the run; lock failure stops execution

ห้ามใช้ `information_schema.tables` เพียงอย่างเดียวในการยืนยัน schema ว่าง ให้ตรวจ `pg_catalog.pg_class` เพราะ privilege filtering เคยทำให้รายงานผิด

## 5. Validation fixtures

ใช้ UUID และข้อมูล fictional ต่อ run เท่านั้น:

- users: `validation-user-a`, `validation-user-b`
- tenant authority: `validation-authority`
- tenant/org/site IDs: random validation-prefixed values
- permissions: `inventory.read`, `inventory.post`
- Argon2id strings: synthetic PHC fixtures ไม่ใช่รหัสผ่านจริง
- session hash: deterministic 32-byte test valueที่ไม่เคยใช้จริง
- actor principals: `validation:bootstrap:<run-id>` และ fictional Factory users

ทุก test case ต้องทำใน transaction/savepoint หรือ disposable database ของตนเอง ห้าม reuse fixture จาก actual Factory

## 6. SQL validation matrix

สถานะทุกกรณีด้านล่างคือ **NOT RUN**

| ID | Case | Action | Expected result | Enforcement |
|---|---|---|---|---|
| ISO-001 | Create schema | Run approved 0005 up body on fresh validation schema | 11 Auth tables, expected constraints/indexes/comments; no business table | SQL |
| ISO-002 | FK inventory | Inspect `pg_constraint` | Every documented FK exists with `ON DELETE RESTRICT` | SQL |
| ISO-003 | Credential user FK | Insert credential for missing user | FK violation; transaction remains usable after savepoint rollback | SQL |
| ISO-004 | External identity uniqueness | Insert duplicate provider+issuer+subject | Unique violation even when first link revoked | SQL |
| ISO-005 | Email uniqueness | Insert same normalized email twice | Unique violation | SQL |
| ISO-006 | Membership scope uniqueness | Duplicate user+tenant/org namespace and IDs | Unique violation | SQL |
| ISO-007 | Session membership integrity | Session user differs from membership owner | Composite FK violation | SQL |
| ISO-008 | Session hash | Hash not 32 bytes or duplicate hash | CHECK/unique violation | SQL |
| ISO-009 | Invalid Argon2id | Plain text, wrong prefix/version, malformed params/salt/hash, too short/long | CHECK violation for every invalid fixture | SQL |
| ISO-010 | Valid PHC shape | Insert synthetic `$argon2id$v=19$m=...,t=...,p=...$salt$hash` fixture | Accepted by shape constraint; cryptographic validity not claimed | SQL + future service |
| ISO-011 | Active role-permission duplicate | Insert second active pair | Partial unique violation | SQL |
| ISO-012 | Active membership-role duplicate | Insert second active pair | Partial unique violation | SQL |
| ISO-013 | Active membership-site duplicate | Insert second active scoped site | Partial unique violation | SQL |
| ISO-014 | Revoke assignment | Create revoke event and set revoked timestamp/event | Original assignment remains queryable and inactive | SQL |
| ISO-015 | Incomplete revocation | Timestamp without event, event without timestamp, same assign/revoke event | CHECK violation | SQL |
| ISO-016 | Re-grant | Revoke old assignment then insert new assignment ID for same pair | New row accepted; old row retained | SQL |
| ISO-017 | Bootstrap replay | Insert second successful `DEVELOPMENT_BOOTSTRAP_COMPLETED` event | Partial unique violation | SQL |
| ISO-018 | Event request replay | Reuse non-null request ID | Unique violation | SQL |
| ISO-019 | Event actor shape | FACTORY_USER without user or SYSTEM/TRUSTED_BOOTSTRAP with user | CHECK violation | SQL |
| ISO-020 | Unknown scope syntax | Empty/oversized authority or ID | CHECK violation | SQL |
| ISO-021 | Unknown but well-formed scope | Insert fictional unresolved tenant/org/site IDs | SQL accepts; future trusted resolver must reject before write | Future Auth Service |
| ISO-022 | PUBLIC ACL | Inspect table ACLs and attempt access as PUBLIC-only role | No Auth table privilege | SQL grants/ACL |
| ISO-023 | Runtime event forgery | Runtime attempts direct event INSERT or TRUSTED_BOOTSTRAP event | Permission denied; future append-event function rejects kind/type | Future grants/function |
| ISO-024 | Runtime assignment mutation | Runtime attempts INSERT/UPDATE/DELETE assignment | Permission denied | Future grants/function |
| ISO-025 | Restore revoked grant | Runtime/admin tries direct `revoked_at=NULL` | Direct table update denied; approved re-grant must create new row | Future column grants/function |
| ISO-026 | Physical history deletion | Runtime/admin attempts DELETE assignment/event | Permission denied | Future grants/function |
| ISO-027 | Session hash confidentiality | Unrelated role attempts SELECT; Auth Service performs exact hash lookup | Unrelated role denied; only approved service path succeeds | Future grants/repository |
| ISO-028 | Empty rollback | Apply up without data, then approved down+ledger transaction | All 11 Auth tables removed; business/ledger rules preserved | SQL + executor |
| ISO-029 | Populated rollback refusal | Insert one Auth user/event then run down | Down fails and original tables/data remain | SQL transaction |
| ISO-030 | Partial DDL failure | Inject approved failure before commit in derived test transaction | No Auth table or ledger row remains | Executor transaction |
| ISO-031 | Duplicate migration version | Re-run executor with same version/checksum | No DDL rerun; explicit duplicate rejection/idempotent stop | Executor |
| ISO-032 | Changed checksum | Same version with different checksum | Hard failure before DDL | Executor |
| ISO-033 | Atomic ledger | Observe successful DDL and 0005 ledger row after one commit | Both exist or neither exists | Executor transaction |
| ISO-034 | Lock contention | Second executor tries same advisory lock | Second run blocks/fails per approved timeout; no concurrent DDL | Executor |

## 7. Security invariant boundary

### SQL-enforced now

- PK/FK and restrictive deletes between Auth entities
- provider identity, normalized email, membership and session-hash uniqueness
- Argon2id PHC shape/version, not cryptographic strength
- session belongs to the same user as selected membership
- append-only assignment row model with active-only uniqueness
- revoke timestamp/event consistency
- one successful bootstrap-completed event
- PUBLIC revocation
- down migration refusal when Auth data exists

### Not enforced by table DDL alone

1. **Restoring revoked privileges:** A table owner or role with broad UPDATE can clear revoke fields. Prevent with no direct assignment UPDATE and reviewed re-grant/revoke functions.
2. **Forged auth events:** Any role with direct INSERT could claim `TRUSTED_BOOTSTRAP` or SYSTEM. Runtime must have no direct event INSERT; function derives actor from verified context and whitelists event types.
3. **Forged bootstrap:** Unique index stops only a second success; it does not prove the first actor. Separate one-time bootstrap principal, advisory lock, marker and capability revocation are required.
4. **Physical deletion:** FK design does not prohibit deleting a standalone assignment. No runtime/admin DELETE grants and function-only mutation are required; migration owner remains a trusted operational boundary.
5. **Session hash disclosure:** `REVOKE ... FROM PUBLIC` is insufficient after future grants. Only the Auth Service lookup path may read hashes; unrelated/admin UI roles must be denied.
6. **Authoritative scope:** SQL validates shape and membership linkage, not whether tenant/org/site IDs are real or owned together. Trusted server resolver remains mandatory and unresolved.
7. **Argon2 strength:** Regex cannot verify memory/time/parallelism minimums or cryptographic validity. Phase 3 verifier must parse and enforce reviewed policy without downgrade.

These are not reasons to trust browser claims or add an Admin bypass. They are explicit gates for future Auth Service/grant implementation.

## 8. Test ordering

1. Obtain separate execution approval and record approved run ID/operator
2. Confirm tooling/image/package availability and integrity — TO CONFIRM
3. Provision fresh isolated PostgreSQL 18 target with marker and ephemeral storage — TO CONFIRM
4. Run isolation preflight before loading any repository SQL — TO CONFIRM
5. Compute source/derived checksums and verify guard-only diff — TO CONFIRM
6. Initialize disposable schema and 0001 ledger through approved executor — TO CONFIRM
7. Execute ISO-001–ISO-010 schema/identity cases using savepoints — TO CONFIRM
8. Execute ISO-011–ISO-019 assignment/bootstrap cases — TO CONFIRM
9. Execute ISO-020 และ ISO-022 ด้วย constraints/ACL scenario — TO CONFIRM; ISO-021 และ ISO-023–ISO-027 — BLOCKED pending trusted resolver/Phase 3 grant/function design
10. Execute ISO-028/ISO-029 on separate fresh disposable runs — TO CONFIRM
11. Execute ISO-030–ISO-034 ผ่าน harness ใน disposable runs แยกกัน — TO CONFIRM และต้องอนุมัติ SQL execution ก่อน
12. Export sanitized evidence, verify no credentials/hashes are present — TO CONFIRM
13. Destroy disposable database, roles, network and volume; verify endpoint unavailable — TO CONFIRM

## 9. Expected evidence package

Required before approving actual migration:

- approval ID, run ID, operator and UTC timestamps
- PostgreSQL 18 exact version and trusted image/package digest
- disposable cluster/database marker and client endpoint (never a credential)
- source and derived SHA-256 plus guard-only diff proof
- migration inventory and advisory lock key
- sanitized PASS/FAIL per ISO case
- `pg_catalog` manifest of 11 tables, constraints, indexes and ACLs
- ledger row showing version/checksum in the same successful transaction
- evidence of full rollback after injected failure
- evidence that populated down migration is rejected without data loss
- evidence that actual `127.0.0.1:5432/ionflow_inventory_dev` was never contacted
- cleanup evidence: validation endpoint unavailable and ephemeral volume absent

Any raw password, SCRAM verifier, Argon2id fixture hash, session hash/secret, connection string or environment dump invalidates the evidence package and requires rerun.

## 10. Failure and recovery rules

- Preflight mismatch: stop before BEGIN
- Lock unavailable: stop; do not bypass or choose another key
- Source/derived checksum mismatch: stop and review; do not regenerate silently
- DDL/constraint/ledger failure before commit: rollback and prove zero Auth objects/ledger row
- Unknown commit outcome: reconnect only to the approved disposable endpoint, compare catalog+ledger checksum, never blind retry
- Negative test unexpectedly succeeds: mark FAIL, preserve sanitized catalog evidence, destroy environment after review
- Cleanup failure: mark BLOCKED and do not approve actual migration until isolated resources are removed
- Never run down against actual Factory to clean up a validation mistake

## 11. Phase 2.8 harness และ command status

ไฟล์ที่เกี่ยวข้อง:

- `scripts/auth-sql-validation-cases.mjs` — manifest ISO-001–ISO-034 และ SQL fixture แบบ fictional
- `scripts/auth-sql-validation-harness.mjs` — fail-closed target check, in-memory guard transform, checksum, server identity preflight และ scenario executor
- `scripts/auth-sql-validation-harness.unit.test.mjs` — static unit tests; ไม่ import/connect PostgreSQL ใน test path

คำสั่งที่ตรวจแล้วและไม่แตะฐานข้อมูล:

- `node scripts/auth-sql-validation-harness.mjs --plan` — แสดง target, source/derived SHA-256 และสถานะ 34 cases; `mode=PLAN_ONLY`, `executable=false`
- `node --test --test-isolation=none scripts/auth-sql-validation-harness.unit.test.mjs` — ตรวจ guard/checksum/target rejection เท่านั้น

หลังได้รับอนุมัติ execution แยกต่างหาก intended invocation คือ `node scripts/auth-sql-validation-harness.mjs --execute` โดย protected launcher ต้องส่งเฉพาะ environment namespace `FACTORY_AUTH_VALIDATION_*` ต่อไปนี้: host, port, database, schema, user, password, run ID, marker, scenario และ explicit approval token ห้ามใช้ `--env-file`, connection URL, `.env.local`, command-line password หรือ environment dump

Scenario ที่เตรียมไว้: `constraints`, `empty-down`, `populated-down`, `partial-failure`, `duplicate-version`, `changed-checksum`, `atomic-ledger`, `lock-contention` แต่ละ scenario ต้องใช้ fresh disposable target ตาม runbook และ PostgreSQL-dependent result ทั้งหมดยังเป็น **NOT RUN**

สถานะ implementation: 28 cases (`ISO-001`–`ISO-020`, `ISO-022`, `ISO-028`–`ISO-034`) มี runner/fixture/assertion ใน harness แล้วแต่ยัง **NOT RUN**; 6 cases (`ISO-021`, `ISO-023`–`ISO-027`) เป็น **BLOCKED / FUTURE_PREREQUISITE** เพราะต้องมี authoritative scope resolver หรือ Phase 3 roles/functions ก่อน การมีโค้ด runner ไม่ถือว่า PostgreSQL case ผ่าน

Expected output ต้องเป็น JSON ที่ไม่มี credential: sanitized case IDs/status หรือ fail-closed error code เท่านั้น ก่อนส่ง evidence ต้องตรวจซ้ำว่าไม่มี environment, password, session hash หรือ connection string

- Container/VM provisioning command: **TO CONFIRM**
- PostgreSQL client/provisioning command: **TO CONFIRM** (พบ binary 18.6 แล้วแต่ยังไม่เคยรันกับ disposable target)
- Harness `--plan` และ scoped unit test: **VERIFIED / NO DATABASE CONNECTION**
- Harness `--execute`: **TO CONFIRM / NOT RUN / REQUIRES EXPLICIT APPROVAL**
- Cleanup command: **TO CONFIRM**
- Actual migration command: **NOT AUTHORIZED**

Credentials must be entered through an approved protected secret channel at execution time, never command arguments, committed scripts or captured output.

## 12. Exit criteria

Actual Factory migration remains blocked until:

1. validation-only two-guard strategy และ derived checksums ได้รับ review/approval
2. disposable PostgreSQL 18 tooling/target is approved and available
3. executor and least-privilege validation roles/functions are reviewed
4. ISO-001–ISO-034 applicable cases pass with sanitized evidence
5. authoritative scope resolver remains a separate Phase 3 gate
6. cleanup is proven complete

This runbook does not authorize SQL execution, provisioning, dependency installation, database/role creation, migration application or deployment.
