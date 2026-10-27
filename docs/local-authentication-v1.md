# PostgreSQL Local Authentication V1 — Phase 1–2

สถานะ ณ 2026-10-27: **Local Login V1 implement แล้วใน source แต่ยังไม่ activate เพราะ 0005, runtime role และ trusted bootstrap ยังไม่ได้รับอนุมัติให้รัน**

> เนื้อหา Phase 1–2 ด้านล่างเป็น historical baseline ก่อน implementation ปัจจุบัน หากข้อความเดิมระบุว่า Login/API/route guard ยังไม่มี ให้ยึดส่วน “Implementation update” นี้เป็นสถานะล่าสุด

## Implementation update

- Argon2id verifier ใช้ `node:crypto.argon2` และรับเฉพาะ PHC `$argon2id$v=19$...` ตามขอบเขต parameter/salt/hash ที่ review แล้ว
- Login, Logout และ Current User APIs อยู่ที่ `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`
- session secret สุ่ม 32 bytes; PostgreSQL เก็บ SHA-256 hash เท่านั้น
- Factory layout ตรวจ database-backed session ฝั่ง server; Logout ตรวจ Origin และ CSRF double-submit token
- PostgreSQL repository ใช้ `factory_auth_runtime` เท่านั้นและปฏิเสธ production, target ผิด, privileged/inherited role และ Auth schema ที่ไม่ครบ
- `scripts/setup-auth-local.mjs` เป็น reviewed one-shot executor สำหรับ 0001 + 0005 + runtime role/grants โดย fail closed, pin SHA-256, ใช้ advisory lock และไม่แตะ 0002–0004
- setup executor ยัง **ไม่ได้รัน** และไม่สร้าง administrator/bootstrap data
- trusted tenant/organization/site resolver ยัง **UNRESOLVED** ดังนั้น Admin bootstrap, membership provisioning และ browser Login จริงยัง **BLOCKED**

### Verified Settings Site inspection (read-only, 2026-10-27)

- พบ Site ID จริงเพียงรายการเดียว: `settings-live-464c9a55-4817-4600-ad33-68a17928afa6-sites`
- Code: `ST-464C9A55-SITES`
- สถานะ: inactive
- ชื่อเป็นข้อมูล Local CRUD test จึงไม่ใช้ชื่อเป็น ownership evidence และ Site นี้ยังใช้ bootstrap ไม่ได้
- ยังไม่มี tenant/organization namespace หรือ ID ที่ได้รับอนุมัติ จึงไม่มี approved mapping ใน `.env.local`

`local-scope-resolver.ts` รับ registry เฉพาะ protected server configuration, ตรวจ tenant → organization → site mapping และยืนยัน Site ID/active state ซ้ำผ่าน Settings PostgreSQL แบบ read-only ทุกครั้งก่อนสร้าง sessionหรือยอมรับ sessionเดิม หาก config หาย, mapping ซ้ำ/ผิด, Site ไม่พบ/inactive หรือ Settings lookup ล้มเหลว จะ fail closed โดยไม่ fallback ไป browser selector

เอกสารนี้บันทึกผลตรวจ repository และฐานข้อมูล local ณ วันที่ 2026-10-26 พร้อมแบบ Auth ที่รองรับ LOCAL ก่อน และ Firebase / Identity Platform ในอนาคต โดยไม่เปลี่ยน Factory user, Membership, Role, Permission หรือ Session model

## 1. ขอบเขตและผลตรวจ Phase 1

- Repository: `D:\Program Files\Project\ionflow-factory-platform`
- Branch ตอนเริ่มตรวจ: `main`
- Commit ตอนเริ่มตรวจ: `beedb69`
- Working tree ตอนเริ่มตรวจ: สะอาด
- อ่าน `AGENTS.md` และทำงานเฉพาะ repository นี้
- ไม่แก้ Login, Factory layout, Dashboard, Sidebar, business module, package, CI, secret หรือ cloud configuration
- ไม่อ่านค่า credential ออกมาแสดงและไม่ขอ secret จากผู้ใช้

### Login และ session ปัจจุบัน

- `src/features/login/login.tsx` เป็น Demo Login ฝั่ง client: submit แล้ว `router.push("/dashboard")` โดยไม่ตรวจ credential
- ค่า email/password เป็นข้อมูลตัวอย่างและถูก reset หลัง submit ไม่มีการส่ง API หรือเก็บ credential
- `app/(factory)/layout.tsx` ไม่มี server session check หรือ route guard
- เมนูผู้ใช้ใน `app-shell.tsx` มีเพียงลิงก์กลับ `/login`; ไม่มี logout/revocation จริง
- `user-settings.tsx` และ `MasterDataProvider` ใช้ personnel/role/module visibility จาก mock state; ห้ามใช้เป็น authorization
- `requirePersistentAccess()` ปฏิเสธทุกครั้งด้วย `AUTH_NOT_CONFIGURED`
- `factory-authorization.ts` มี provider-independent adapter contract และตรวจ issuer/audience, expiry, revocation, membership, site และ permission แบบ fail-closed แต่ยังไม่มี production adapter
- permission ที่มี contract แล้วคือ `inventory.read` และ `inventory.post`; role ไม่ได้ให้สิทธิ์โดยอัตโนมัติ

### PostgreSQL ที่ตรวจจริงแบบ read-only

ใช้เฉพาะ target ที่อนุมัติ:

- Host: localhost/loopback
- Port: 5432
- Database: `ionflow_inventory_dev`
- Schema: `inventory_sandbox`

ผลตรวจ:

- การเชื่อมต่อ, database, schema USAGE และข้อจำกัด application role: PASS
- transaction metadata inspection ยืนยัน `transaction_read_only = on`
- physical catalog (`pg_catalog.pg_class`) พบ `settings_masters`, `production_orders` และ `production_order_history`
- writer roles อ่านแบบ read-only พบข้อมูลจริง: Settings 14 แถว, Production Orders 3 แถว และ Production History 9 แถว
- `schema_migrations` ไม่มี จึงไม่มี migration provenance หรือ applied checksum ที่ยืนยันจากฐานข้อมูลได้
- `bulk_production_orders` และ Auth tables ยังไม่มี
- role ที่พบ: `factory_readonly`, `factory_settings_writer`, `factory_production_writer`
- ทั้งสาม role ไม่เป็น superuser, ไม่มี CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS, ไม่มี database/schema CREATE, มี CONNECT และ schema USAGE, ไม่มี inherited role membership
- `factory_auth_runtime`: ยังไม่มี

รายงานเดิมที่ว่า schema ว่างเกิดจากใช้ `information_schema.tables` ผ่าน `factory_readonly` ซึ่งไม่มี table privilege และ view นี้ซ่อน object ที่ role มองไม่เห็น การมี physical schema ที่เทียบเท่า 0002/0003 ไม่พิสูจน์ว่า checked-in migration files ฉบับปัจจุบันเป็นไฟล์ที่เคยถูกรัน เพราะไม่มี ledger/checksum การตรวจนี้ไม่ใช่การพิสูจน์ว่า cluster ไม่มี database/schema/role อื่น และไม่ได้ตรวจหรือเปลี่ยน production, staging, Cloud SQL หรือ database อื่น

### Migration state ใน repository

| Version | ไฟล์ | สถานะฐานข้อมูลที่ยืนยันได้ |
|---|---|---|
| 0001 | migration ledger | ไม่มี physical table; ยังไม่ apply |
| 0002 | Settings masters | มี physical schema และข้อมูล 14 แถวที่เทียบโครงสร้างกับไฟล์ได้; execution provenance ยังไม่ยืนยัน |
| 0003 | Production Orders | มี physical schema และข้อมูล 3+9 แถวที่เทียบโครงสร้างกับไฟล์ได้; execution provenance ยังไม่ยืนยัน |
| 0004 | Bulk Production Orders | ไม่มี physical table; defer และไม่มี down file |
| 0005 | Factory Auth | เตรียมในงานนี้ แต่ยังไม่ apply |

ห้าม insert 0002/0003 ลง ledger ว่า “applied” จากความเหมือนของ schema เพียงอย่างเดียว ต้องมี DBA-approved baseline evidence แยกต่างหาก และ state ต้องตรวจซ้ำก่อนการ apply ทุกครั้ง

## 2. ช่องว่าง Authentication ที่พบ

1. ไม่มี Local credential verifier และยังไม่ได้เลือก Argon2id library/parameters
2. ไม่มี Factory user, external identity link, membership, role/permission assignment หรือ site scope ที่ persist จริง
3. ไม่มี database-backed session, cookie, revocation หรือ expiry validation ใน request path
4. ไม่มี login/logout/me API, Origin/CSRF check หรือ rate limiting
5. ไม่มี route guard; Factory workspace เปิดตรงได้
6. ไม่มี authoritative tenant/organization master; `settings_masters` มี physical site/warehouse master แต่ยังไม่มี contract ว่าเป็น authoritative scope resolver ของ Auth
7. ไม่มี `factory_auth_runtime` และยังไม่ได้อนุมัติ grants
8. Demo personnel, UI role/module selection, signer text และ Sidebar visibility ไม่ใช่ security principal

## 3. Data ownership ที่ล็อกไว้

- `factory_users` เป็น identity ภายในที่คงที่ ไม่ใช่ personnel master และไม่สร้าง tenant/organization/site ซ้ำ
- LOCAL credential เป็นเพียงวิธีพิสูจน์ตัวตนของ Factory user
- Firebase identity ในอนาคตต้อง map ด้วย `(provider, verified issuer, verified subject)` ผ่าน explicit administrative link เท่านั้น
- Email ใช้ค้นหา LOCAL credential ได้ แต่ห้ามใช้ auto-link Firebase identity
- Membership, Roles, Permissions, Site assignments และ Sessions เป็นของ Factory
- tenant/organization/site ID ต้องเก็บคู่ namespace ผู้เป็นเจ้าของ (`*_authority`) และ validate กับแหล่ง authoritative ที่อนุมัติ
- เนื่องจากยังไม่มี authoritative tenant/organization table จึงไม่สร้าง FK ปลอมและไม่สร้าง master ซ้ำ
- `site_id` ยังไม่ FK ไป `settings_masters`: schema ปัจจุบันบังคับไม่ได้ว่า row นั้นมี `kind='sites'` โดยไม่แก้ Settings table ซึ่งอยู่นอก scope
- trusted resolver ต้องรับ namespaced ID จาก server-owned provisioning/session context, resolve canonical tenant → organization → site ownership และคืน active scope เท่านั้น
- ต้องเรียก resolver ก่อน membership provisioning, site assignment, role assignment, session creation และทุก protected business operation
- client-provided tenant/organization/site IDs เป็นเพียง selector; ถ้า resolver unavailable, ambiguous หรือไม่พบ mapping ให้ปฏิเสธ ห้ามสร้าง identity/mapping ใหม่จากชื่อหรือ code
- authoritative owner/resolver จริงยัง **UNRESOLVED** จึง block provisioning และ Phase 3 enablement
- business tables และ Stock Ledger ไม่อ้าง Auth migration ใน phase นี้

## 4. Auth schema ที่เสนอ

Migration: `migrations/0005_factory_auth.up.sql`

### ตารางและความสัมพันธ์

| ตาราง | หน้าที่ | ความสัมพันธ์สำคัญ |
|---|---|---|
| `factory_users` | Stable Factory user, normalized email, display name, active/deactivated state | Root identity |
| `factory_local_credentials` | Argon2id PHC hash และ algorithm/version metadata | 1:1 กับ user |
| `factory_identity_links` | External verified identity ที่ admin link อย่างชัดเจน | หลาย link ต่อ user; provider+issuer+subject unique |
| `factory_memberships` | User ใน tenant/organization scope พร้อม active/expiry | หลาย membership ต่อ user |
| `factory_roles` | Named Factory role ไม่มี wildcard/admin bypass | M:N กับ membership และ permission |
| `factory_permissions` | Permission code ที่ชัดเจน | รองรับ `inventory.read`/`inventory.post` เดิมโดยใช้ code เดิม |
| `factory_role_permissions` | Append-only Role-to-permission assignment | Stable ID, assigned/revoked events, active-only uniqueness |
| `factory_membership_roles` | Append-only Role assignment ต่อ membership | Stable ID, assigned/revoked events, active-only uniqueness |
| `factory_membership_sites` | Append-only Site scope ต่อ membership | Stable ID, trusted namespace, assigned/revoked events |
| `factory_sessions` | Server-side revocable session | ผูก user+membership ด้วย composite FK |
| `factory_auth_events` | Verified actor/event/outcome/reason/session | Assignment rows อ้าง event ผู้ให้/ถอนสิทธิ์; ไม่มี credential/token/session secret |

### Primary key และ credential

- ใช้ UUID ที่ application สร้างแบบ cryptographically random; migration ไม่เพิ่ม extension และไม่มี sequence
- email unique ด้วย `email_normalized = lower(trim(email))`
- credential เก็บเฉพาะ Argon2id PHC string รูปแบบ `$argon2id$v=19$m=...,t=...,p=...$salt$hash` พร้อม algorithm/version metadata
- database ปฏิเสธ prefix/version/PHC shape ที่ผิดอย่างชัดเจน; Phase 3 verifier ต้อง parse และตรวจ algorithm, version, salt/hash และ reviewed minimum memory/time/parallelism parameters
- ห้าม plaintext password, reversible encryption และ password hint
- Argon2id parameters ต้อง review เทียบ library/OWASP guidance ณ วันที่ implement; schema ไม่ hard-code parameter ที่อาจล้าสมัย
- ห้าม fallback/downgrade ไป PBKDF2, bcrypt, SHA digest หรือ algorithm อื่นเมื่อ Argon2id verify ล้มเหลว
- credential ที่ disabled หรือ revoked ต้องถูกปฏิเสธเหมือน credential ผิด โดยไม่เผยสถานะ user

### Session secret

- Client ได้ opaque random secret ที่มี entropy อย่างน้อย 256 bits
- Database เก็บ SHA-256 hash 32 bytes เท่านั้น
- เปรียบเทียบ hash แบบ constant-time ใน application
- ป้องกัน fixation โดยสร้าง secret ใหม่หลัง login สำเร็จและเมื่อ privilege/scope เปลี่ยน
- session ต้องผ่านทุกเงื่อนไข: user active, membership active/not expired, session not expired/not revoked และ scope ยังอนุญาต
- logout และการ deactivate user/membership ต้อง revoke server session ที่เกี่ยวข้อง

### Permission semantics

- Permission code เป็น explicit allow; ไม่มี `*`, role name shortcut หรือ implied Admin
- `inventory.read` และ `inventory.post` ต้องคง code/ความหมายเดิม
- role เป็นกลุ่ม permission เท่านั้น; server operation ต้องตรวจ permission ที่ต้องการโดยตรง
- tenant/organization/site selectors จาก browser เป็นเพียงค่าที่ร้องขอและต้องอยู่ใน verified membership
- assignment ทั้งสามชนิดห้าม DELETE; การถอนสิทธิ์ต้อง set `revoked_at` พร้อม `revoked_event_id` และเก็บ record เดิม
- partial unique indexes ป้องกัน active grant ซ้ำ แต่อนุญาตให้ re-grant ด้วย assignment ID ใหม่หลัง record เก่าถูก revoke
- assigning/revoking event ต้องมาจาก verified Factory user หรือ trusted bootstrap principal; runtime request ห้ามสร้าง `TRUSTED_BOOTSTRAP` event

## 5. Least-privilege database plan

Migration ไม่สร้าง role, password หรือ user และไม่ GRANT ให้ role ที่ยังไม่มี โดยจะ `REVOKE ALL ... FROM PUBLIC` สำหรับ Auth tables

ขั้นต่อไปที่ต้องขออนุมัติ DBA แยกต่างหาก:

1. สร้าง `factory_auth_runtime` เป็น LOGIN, `NOINHERIT`, ไม่เป็น owner, ไม่มี superuser/CREATEDB/CREATEROLE/REPLICATION/BYPASSRLS/CREATE
2. ให้ CONNECT เฉพาะ development database และ USAGE เฉพาะ schema ที่ต้องใช้
3. ให้ SELECT บน users, credentials, identity links, memberships, roles, permissions และ assignment tables
4. ให้ SELECT/INSERT/UPDATE ที่จำเป็นบน sessions; ไม่ให้ DELETE
5. ไม่ให้ runtime INSERT/UPDATE/DELETE `factory_auth_events` โดยตรง ให้ EXECUTE เฉพาะ reviewed append-event function ซึ่ง whitelist event/actor kind และสร้าง actor จาก verified server context
6. `factory_auth_runtime` ไม่มี INSERT/UPDATE/DELETE บน role/permission/site assignments และไม่สามารถเรียก bootstrap procedure
7. administrative provisioning role ไม่มี direct table bypass ให้ EXECUTE เฉพาะ reviewed assign/revoke functions ที่ตรวจ scope, สร้าง auth event และแก้ assignment ใน transaction เดียว
8. bootstrap principal แยกจาก runtime/admin ปกติ ใช้ได้ครั้งเดียวและถอน capability หลัง commit
9. การจัดการ user/credential/identity link/role/permission ใช้ administrative path/role แยก ไม่ใช้ login runtime
10. ตรวจ effective grants, function ownership/search_path, column grants, default ACL, role membership และ ownership หลัง provisioning

ไม่มี grant ใดถูก apply ในงานนี้

## 6. Independent Auth migration order และ rollback

ลำดับที่แนะนำ:

1. ตรวจ exact database/schema/physical objects/owner/grants ซ้ำด้วย `pg_catalog` แบบ read-only
2. Review และอนุมัติ 0001 ledger initialization แยก; 0001 เป็น governance dependency ไม่ใช่ FK/DDL dependency ของ Auth
3. เก็บ signed baseline evidence สำหรับ physical 0002/0003; ห้าม rerun และห้ามบันทึกว่า checked-in files ถูก apply หากพิสูจน์ provenance ไม่ได้
4. Defer 0004 อย่างชัดเจน; migration version gap ใช้ได้และไม่ใช่เหตุผลให้ apply Bulk schema
5. Review 0005, authoritative scope resolver และ checksum ฉบับสุดท้าย
6. Provision Auth runtime/admin/bootstrap roles แยก โดยไม่ reset role เดิม
7. Apply 0005 ผ่าน approved executor ภายใต้ transaction/advisory lock และบันทึก 0005 ledger row ใน transaction เดียว
8. ตรวจ tables, constraints, indexes, PUBLIC privileges และ effective grants
9. จึงทำ development bootstrap แบบ explicit หลังได้รับอนุมัติใหม่

Rollback:

- ปิด feature/auth integration ก่อน
- down migration ยอม drop เฉพาะเมื่อ Auth ทุกตารางว่าง
- ไม่ใช้ CASCADE และไม่ลบ audit/session/user เพื่อบังคับ rollback
- ถ้ามีข้อมูลแล้วให้ใช้ forward repair/export/recovery เท่านั้น
- business migrations/tables ไม่ถูกเปลี่ยนหรือ drop

0005 ไม่อ้าง Settings, Production หรือ Bulk tables และไม่ต้อง apply 0002–0004 ก่อน Missing 0004 down เป็น issue ของ Bulk migration แยก ไม่ block Auth-only setup

## 7. Migration ledger execution procedure (documentation only)

ห้ามรัน migration file ตรง ๆ จนกว่าจะมี reviewed executor/procedure ที่ทำขั้นตอนต่อไปนี้:

1. สร้าง reviewed inventory ของ filename, logical version และ lowercase SHA-256; version ใช้ชื่อเช่น `0005_factory_auth` ไม่รวม `.up.sql`
2. ยืนยัน loopback endpoint, port 5432, database `ionflow_inventory_dev`, schema OID/owner และ approved migration-owner identity
3. เปิด transaction และถือ `pg_advisory_xact_lock` ด้วย Factory migration namespace/version ตลอดการตรวจและ apply
4. อ่าน ledger ด้วย lock; ถ้า version มี checksum เดิมต่างจากไฟล์ให้หยุด ถ้ามี checksum เดียวกันให้ปฏิเสธ duplicate execution แบบสำเร็จโดยไม่รัน DDL ซ้ำ
5. ตรวจ expected pre-state: 0001 ต้องไม่มี ledger table; 0005 ต้องไม่มี Auth table/index ใดและ business objects ต้องไม่ถูกแก้
6. 0001 initialization ต้องสร้าง ledger และบันทึก checksum ของ 0001 ด้วย reviewed bootstrap step; ห้ามแอบบันทึก 0002/0003 เป็น applied
7. physical 0002/0003 ที่มีอยู่ต้องเก็บใน signed external baseline manifest จนกว่าจะพิสูจน์ execution provenance ได้; executor ต้องมี explicit approved skip list และห้ามพยายาม apply ซ้ำ
8. 0004 คงสถานะ deferred และไม่มี ledger row
9. สำหรับ 0005 ให้ executor รัน reviewed migration body และ INSERT `(version, checksum_sha256, applied_by)` ก่อน COMMIT เดียวกัน หาก DDL หรือ ledger insert ล้มเหลวให้ rollback ทั้งหมด
10. หลัง commit ตรวจ catalog, constraints, indexes, PUBLIC ACL และ ledger checksum แบบ read-only

Checksum inventory ณ Phase 2.6:

- `0001_foundation`: `ba7c01a162e40b1221ea2a786a04200fc7fae0d87bc3da827c477666281fe0a9`
- `0002_settings_masters`: `e6fd2a399c07460a9cfe355c1c7a539e90810c1b0758d6179ed31c4d1408a498` — physical equivalent observed, provenance unverified
- `0003_production_orders`: `4953475f57cbc1cf6810478e82fe15cdef940657f4032a7097aeb5d0690c52ef` — physical equivalent observed, provenance unverified
- `0004_bulk_production_orders`: `0bd11fd652e451ad7d7c842fd603d5b554d04d953252721dfc676cce6bcc65ca` — deferred
- `0005_factory_auth`: `7ef8f18c1a3fcd75625692f81788ac541741780d2754bf8d88ce560ccf4377c3` — prepared, not applied

Rollback/forward recovery:

- ก่อนมี Auth data สามารถใช้ reviewed down migration ภายใต้ lock และ update ledger ใน transaction เดียว
- หลังมี user/session/audit/assignment data ห้ามลบเพื่อให้ down ผ่าน ให้ปิด feature/revoke access และใช้ forward repair
- unknown commit outcome ต้อง inspect catalog+ledger ด้วย checksum ก่อน retry ห้าม rerun แบบเดา
- baseline manifest และ ledger history ห้าม rewrite เพื่อลบร่องรอย

Reviewed executor อยู่ที่ `scripts/setup-auth-local.mjs` แต่ยังไม่ได้รัน ตัว executor:

- ต้องเรียกด้วย `--execute` พร้อม out-of-band approval value `FACTORY_AUTH_SETUP_APPROVED=APPROVED_LOCAL_AUTH_SETUP`
- อ่าน admin secret จาก protected `.env.local` เท่านั้น ไม่รับ password จาก command argument และลบ setup secret ออกจากไฟล์หลังสำเร็จ
- ตรวจ exact loopback database/schema, PostgreSQL superuser migration owner, business baseline, empty Auth state และ migration checksums ก่อนเปลี่ยนแปลง
- strip เฉพาะ transaction wrapper ของ 0001/0005 แล้วรัน DDL, ledger rows, role creation และ grants ใน transaction/advisory lock เดียว
- สร้าง runtime credential แบบสุ่มและส่งเฉพาะ SCRAM verifier เข้า SQL
- เก็บ `FACTORY_AUTH_ENABLED=false` และ `FACTORY_AUTH_LOCAL_SCOPE_ENABLED=false` หลัง setup; ต้องเปิดภายหลังจาก trusted scope และ bootstrap สำเร็จเท่านั้น
- ให้ runtime อ่าน Auth identity/scope/permission/session tables และเขียนเฉพาะ session create/revoke; ไม่มีสิทธิ์เขียน assignment, audit event หรือ DELETE
- ปฏิเสธ existing ledger/Auth role/Auth object แทนการ replay, reset password หรือ repair อัตโนมัติ

การมี executor ใน source ไม่ใช่ authorization ให้รัน และไม่มี ledger/database object ถูกสร้างในงานเตรียมนี้

## 8. Trusted development bootstrap ภายหลัง (ยังไม่ทำ)

Bootstrap ต้องเป็นคำสั่ง manual แบบ one-time ที่:

1. เรียกได้เฉพาะ approved one-time bootstrap principal/role ซึ่งไม่ใช่ `factory_auth_runtime` และไม่มี application path เข้าถึง
2. ตรวจ exact loopback target, 0005 checksum/ledger, Auth schema และ authoritative scope mapping
3. ถือ advisory lock และปฏิเสธทันทีถ้ามี successful `DEVELOPMENT_BOOTSTRAP_COMPLETED` event; unique partial index เป็น replay backstop
4. รับ password ผ่าน protected local input/config ไม่ผ่าน CLI argument, SQL file, source control หรือ chat
5. สร้าง UUID และ Argon2id PHC hash ใน memory; ไม่ log password/hash
6. สร้าง non-privileged Factory user, LOCAL credential, verified membership และ site scope ใน transaction เดียวตามชุดสิทธิ์ที่อนุมัติ
7. สร้าง auth event ที่ `actor_kind='TRUSTED_BOOTSTRAP'`, `actor_principal` เป็น approved database/bootstrap principal และให้ assignment rows อ้าง `assigned_event_id`
8. สร้าง permission/role แบบ explicit ไม่มี wildcard และไม่มี implicit administrator bypass
9. บันทึก `DEVELOPMENT_BOOTSTRAP_COMPLETED` success event เป็นขั้นสุดท้ายก่อน commit; ความล้มเหลว rollback ทั้ง transaction
10. ล้าง bootstrap secret จาก protected config หลังสำเร็จและถอน/disable bootstrap capability

ไม่มี administrator account หรือ seed data ถูกสร้างใน migration

สถานะล่าสุด: ขั้นตอนนี้ยังไม่มี executable เพราะ repository ไม่มี authoritative tenant/organization owner และไม่มี contract ที่ยืนยันว่า `settings_masters(kind='sites')` ผูกกับ tenant/organization ใด การรับ ID จาก operator หรือ browser แล้วสร้าง membership จะละเมิด fail-closed boundary จึงต้องอนุมัติ resolver/mapping ก่อน จากนั้นจึง implement bootstrap ตาม 10 ข้อข้างต้นและทดสอบใน disposable PostgreSQL ก่อนใช้กับ Factory local

Bootstrap rollback: ก่อน commit ให้ rollback ทั้ง transaction หลัง commit ห้ามลบ actor/assignment/audit evidence ให้ deactivate user, revoke credential/membership/assignments/sessions ด้วย verified administrative events และใช้ forward recovery

## 9. Future verified identity contract (documentation only)

Provider adapter ต้องคืนค่า verified identity แบบ provider-independent:

```ts
type VerifiedIdentity = {
  provider: "local" | "firebase";
  issuer: string;
  subject: string;
  factoryUserId: string;
  verifiedAt: string;
};
```

LOCAL:

- normalize email → lookup active user/credential → Argon2id verify
- issuer คงที่ของ Factory local development และ subject เป็น stable Factory user ID

Firebase ในอนาคต:

- SDK ฝั่ง server ต้อง verify signature, issuer, audience, expiry และ revocation
- lookup identity link ด้วย exact provider+issuer+subject
- ถ้าไม่พบ link ให้ปฏิเสธ; ห้ามค้นหา/link ด้วย email
- link ใหม่ต้องผ่าน authenticated administrative workflow และ audit
- เปลี่ยน provider ได้โดย Factory user ID, membership, roles และ sessions schema ไม่เปลี่ยน

Future flow ที่ล็อกไว้:

1. รับ credential
2. provider adapter verify
3. resolve active Factory user
4. resolve active/non-expired membership
5. validate tenant/organization/site scope
6. สร้าง random database-backed session ใหม่
7. ตั้ง HttpOnly session cookie
8. protected route validate session ทุก request
9. business API ตรวจ explicit permission
10. logout revoke session ฝั่ง serverก่อนลบ cookie

## 10. Future API contract (documentation only)

### `POST /api/auth/login`

Request JSON:

```json
{ "email": "user@example.test", "password": "<secret>", "membershipId": "<optional UUID>" }
```

- validate content type, bounded email/password length และ exact allowed fields
- validate Origin ก่อนอ่าน/verify credential
- rate limit ทั้ง network key และ keyed hash ของ normalized email; raw password ห้ามเข้า log/cache
- generic `401 {"error":{"code":"INVALID_CREDENTIALS"}}` สำหรับ unknown, inactive, disabled/revoked หรือ password ผิด
- ถ้ามี active membership เดียวเลือกได้; ถ้ามีหลายรายการต้องให้ผู้ใช้เลือกจากผลหลัง credential ผ่านเท่านั้น
- membership selector จาก client ต้อง validate กับ verified user
- success `200 {"user":{...},"membership":{...}}` และ set session cookie; ไม่คืน session secret ใน JSON
- database unavailable ใช้ generic `503 {"error":{"code":"AUTH_UNAVAILABLE"}}`; ห้าม fallback เป็น Demo access

### `POST /api/auth/logout`

- ต้องมี valid session, Origin/CSRF protection
- revoke database session ก่อน expire cookie
- idempotent; response `204`
- ถ้า DB outcome ไม่ทราบ ห้ามอ้างว่า revoke สำเร็จ; expire browser cookie และบันทึก safe server error

### `GET /api/auth/me`

- validate session hash, expiry, revocation, active user/membership และ scope
- success คืนเฉพาะ user display data, selected membership, site IDs, roles และ explicit permissions
- invalid/expired/revoked ใช้ generic `401`
- ไม่คืน password metadata, identity subject, raw session, token หรือ internal reason

### Cookie และ request security

- production proposal: `__Host-ionflow-factory-session`; `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, ไม่มี `Domain`
- local HTTP development ใช้ชื่อแยกและห้ามเปิดเมื่อ `NODE_ENV=production`
- cookie value เป็น `session-id.secret` หรือ opaque equivalent; DB เก็บ hash ของ secret เท่านั้น
- rotate หลัง login/scope change และใช้ absolute server expiry; optional idle expiry/last-used update ต้อง bounded
- state-changing endpoint ตรวจ exact allowed Origin และ CSRF token/pattern ที่ review แล้ว; SameSite อย่างเดียวไม่พอ
- redirect รับเฉพาะ same-origin relative path จาก allowlist; default `/dashboard`
- response/error/log ต้องไม่แยก unknown email ออกจาก password ผิด

## 11. Security gates ก่อน Phase 3

- เลือกและ review Argon2id library/parameters โดยไม่เพิ่ม dependency จนได้รับอนุมัติ
- ตกลง authoritative tenant/organization/site mapping
- อนุมัติ 0001 ledger procedure และ signed 0002/0003 baseline; 0004 ยังคง deferred แยกจาก Auth
- review cookie name/lifetime, absolute/idle expiry และ session rotation
- ออกแบบ distributed rate limit ที่ fail safely; in-memory limiter ไม่พอสำหรับหลาย instance
- ออกแบบ CSRF/Origin allowlist และ trusted proxy/IP handling
- อนุมัติ runtime/admin/migration roles และ effective grants
- ระบุ production cutover flag ที่ปฏิเสธ LOCAL development credentials ใน production
- ทดสอบ timing/user-enumeration behavior, concurrent login/revoke, disabled user/membership และ DB failure
- route/API guard ต้อง fail closed; Sidebar visibility ไม่ใช่ authorization

## 12. Historical Phase 2 stop condition

Phase 2 เดิมหยุดที่จุดต่อไปนี้ก่อนที่ Local Login V1 จะได้รับอนุมัติให้ implement ในภายหลัง:

- ไม่มี migration execution
- ไม่มี user/role/credential/session ถูกสร้าง
- ไม่มี Login/API/layout/route guard เปลี่ยน
- ไม่มี Firebase SDK/dependency
- ไม่มี deployment, commit หรือ push

รายการนี้เป็นประวัติ ไม่ใช่สถานะ source ปัจจุบัน; สถานะล่าสุดอยู่ใน Implementation update ด้านบน

## 13. Focused Local Login integration cases

หลังได้รับอนุมัติ migration/runtime/bootstrap ให้รันเฉพาะกรณีต่อไปนี้กับบัญชีทดสอบที่ bootstrap อย่างถูกต้อง:

| Case | Expected result |
|---|---|
| Successful login | 200, session HttpOnly cookie + CSRF cookie, `/dashboard` เปิดได้ |
| Invalid password | generic 401, ไม่มี session row/cookie |
| Inactive user | generic 401 เท่ากับ password ผิด |
| Missing/expired membership | generic 401, ไม่สร้าง session |
| Session persistence | refresh/GET `/api/auth/me` คืน verified user เดิมก่อน expiry |
| Logout | session ถูก revoke ก่อนลบ cookie; `/api/auth/me` เป็น 401 |
| Revoked session | direct URL และ `/api/auth/me` ถูกปฏิเสธ |
| Unauthorized direct URL | Factory layout redirect ไป `/login` |
| CSRF rejection | Logout ที่ token หาย/ไม่ตรงเป็น 403 และ session ยังไม่ถูก revoke |
| Cross-site request | Origin/Host/Sec-Fetch-Site ผิดเป็น 403 ก่อน credential/session mutation |
| PostgreSQL failure | generic 503 หรือ redirect `/login`; ไม่มี demo/mock bypass |

SQL/runtime และ browser cases ในตารางนี้ยัง NOT RUN จนกว่าจะมี approval และ trusted bootstrap data
