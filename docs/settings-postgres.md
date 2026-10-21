# Settings PostgreSQL: local development only

## Latest executed setup — 2026-10-21

**REAL POSTGRESQL MASTER CRUD PASS (all 14 categories); Users/Branding remain unchanged.**

- Authenticated authorized local postgres setup session, then created only factory_settings_writer with a fresh random credential (not the admin credential). Applied reviewed 0002 atomically with minimal Settings grants to inventory_sandbox.settings_masters. No other database/schema/role was modified.
- Writer authenticated successfully. SELECT/INSERT/UPDATE true; DELETE/TRUNCATE/schema CREATE false; SUPERUSER/CREATEDB/CREATEROLE/INHERIT/REPLICATION/BYPASSRLS false. factory_readonly has no write grant on the Settings table.
- Protected ignored .env.local now enables Settings with its separate writer credential. The one-time FACTORY_SETUP_ADMIN_PASSWORD entry was removed. No credential is printed or committed.
- Real live verifier passed CREATE/READ for all 14 kinds, UPDATE/reread, duplicate/stale/invalid-input/origin/physical-delete rejection, and durability across restart of its own API process. Direct PostgreSQL reread confirmed 14 test records deactivated and retained, run prefix settings-live-464c9a55-4817-4600-ad33-68a17928afa6-. No existing user record was used or deleted.
- Local API was started on 127.0.0.1:4317 after verification. This does not prove browser reload or restart of the user's Next.js process; those must be reported separately. Existing PUBLIC isolation findings are not resolved by Settings table grants.
- Actual Factory dev UI was identified at **http://localhost:3000/settings** (3002 returned 404). Protected local configuration now allows only Origin http://localhost:3000, and only the agent-owned Settings API was restarted. Browser inspection of the Site category successfully displayed the persisted UPDATED test record as inactive from PostgreSQL. No existing user Next process was stopped/restarted; browser form submission/reload are not claimed by this read-only UI check.
- The earlier BLOCKED observations below are historical setup prerequisites, not the latest live CRUD result. Setup helper refuses existing role/table rather than resetting passwords or replaying migration blindly. Do not rerun setup against the completed state.

## Inventory / migration status

Settings has one route `/settings`, with its existing nested menu:

- Users (display name, email, department, role, active, module visibility): existing in-memory MasterDataProvider personnel; only editing existing users is currently exposed. NOT MIGRATED in this patch. These values are not authentication/RBAC.
- Fourteen MasterKind menus: sites, areas, warehouses, departments, lines, shifts, vehicleTypes, vehicles, equipment, units, categories, brands, processes, suppliers. Fields remain MasterRow's id/kind/code/name/active/type/parentId/typeId/start/end/contact/phone/aliases. PostgreSQL repository and async UI are implemented; **real database CRUD and API restart passed** as recorded above. No fallback to in-memory data.
- Branding: factoryName, shortName, logoDataUrl, loginImageDataUrl, primaryColor, from BrandingProvider/localStorage. NOT MIGRATED. The root provider affects the whole application, which this patch does not change.

Sources inspected: settings/page.tsx; settings-page.tsx; settings-sidebar.tsx; master-settings.tsx; user-settings.tsx; branding-editor.tsx; branding-provider.tsx under components/factory; master-domain.ts/master-provider.tsx/master-select.tsx; mock-data/settings.ts, master-settings.ts and existing internal-masters dependency; lib/branding.ts; database/config.ts and existing database foundation; existing Settings tests. No Settings document-number configuration exists in these menus; INB and other document numbering are untouched.

Actual local read-only catalog inspection: ionflow_inventory_dev/inventory_sandbox, factory_readonly, zero tables and only factory_readonly among factory_* roles. FACTORY_SETTINGS_ENABLED was not true; Settings write username/password were absent. No admin or migration credentials were sought. No migration, role creation or business write was executed.

## Prepared database and API

0002_settings_masters.up.sql creates ONLY inventory_sandbox.settings_masters, based on the existing generic MasterRow model: typed id/kind/code/name/parent/type references plus validated JSONB for remaining existing fields. It has PK, unique case-insensitive kind+code/name, restrictive self FKs, version and timestamps. JSON header keys must match columns. Domain saveMaster validates source rules, dependencies, cycle detection and preserves historical aliases. No default/demo rows are inserted.

Every save obtains a transaction-scoped Settings advisory lock, reloads current DB state, checks expected version, validates, writes and returns the new DB snapshot atomically. All values use parameters; SQL identifiers are fixed. A stale retry conflicts rather than silently overwriting. Driver errors are sanitized; failed transactions rollback and release/destroy connections. Writes use a separate pool/identity configured through the existing validated target/timeouts, never change the global read-only pool into a writer.

Permanent DELETE intentionally returns 409: until other modules' mock references and personnel dependencies can be reliably represented, missing SQL FKs do not prove no usage. Use existing active=false action. No deletion or cleanup of existing demo fixtures/localStorage is performed. Other modules retain their original Providers and snapshots, so newly persisted Settings do NOT yet synchronize into BOM, Inventory or operational mock forms. This is an explicit compatibility boundary, not a claim that all app data is migrated.

`settings-local-server.mjs` exposes GET/POST/DELETE /masters at **127.0.0.1:4317 only**. It is a developer service, not a public Next API route. Requires NODE_ENV=development and FACTORY_SETTINGS_ENABLED=true. Both actual socket peer and browser Origin/expected Host are checked; forwarding headers are rejected. Only one configured HTTP loopback app origin is allowed; preflight is checked too, no wildcard CORS or cookies. JSON body is bounded and writes require application/json. Production and unknown locality fail closed. Local machine processes are in the trusted development boundary; this is not production user authorization and must never be reverse-proxied or bound publicly. Existing global requirePersistentAccess stays unchanged.

The existing Settings master table/forms keep their fields/layout, adding only async loading/errors/retry and disabled-saving feedback. Existing search/filter/pagination remain client-side on persisted rows. Empty database means an empty list, not seeded fixtures. Users/Branding continue their old explicitly separate stores; no cross-module provider is removed.

## Separate approved setup — NOT EXECUTED

An authorized DBA/migration owner must first confirm localhost:5432/ionflow_inventory_dev, inspect inventory_sandbox and dependencies and review 0002. Apply the up SQL only after checking the table does not already exist. No IF NOT EXISTS masking of incompatible schema, no CASCADE. Keep reviewed migration checksum/application evidence using the existing 0001 strategy; no invented history rows. 0001 need not be run implicitly by this service.

Exact privileges to review/run in the authorized database, NOT as app SQL:

```sql
-- Only if absent; stop and inspect effective grants/ownership/memberships if it exists.
CREATE ROLE factory_settings_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE ionflow_inventory_dev TO factory_settings_writer;
GRANT USAGE ON SCHEMA inventory_sandbox TO factory_settings_writer;
GRANT SELECT, INSERT, UPDATE ON inventory_sandbox.settings_masters TO factory_settings_writer;
```

Set a fresh password through a secure administrator-local interactive mechanism (for example psql's interactive password command), never a literal SQL file, command argument or chat. Do not reuse/reset factory_readonly or administrative credentials. No DELETE/CREATE/TRUNCATE/all-tables/default-privilege grants. Runtime must not own the table/schema/database, have role membership/admin flags, or receive unrelated grants. PUBLIC TEMP/other-schema/other-database access findings still require a separately approved DBA isolation plan; do not revoke shared PUBLIC rights automatically.

Configure these existing/new variables locally without changing unrelated settings:

```dotenv
FACTORY_DB_ENABLED=true
FACTORY_DB_HOST=localhost
FACTORY_DB_PORT=5432
FACTORY_DB_NAME=ionflow_inventory_dev
FACTORY_DB_SCHEMA=inventory_sandbox
# Keep FACTORY_DB_USER/PASSWORD for the readonly identity unchanged.
FACTORY_SETTINGS_ENABLED=true
FACTORY_SETTINGS_DB_USER=factory_settings_writer
FACTORY_SETTINGS_DB_PASSWORD=<set securely locally>
FACTORY_SETTINGS_APP_ORIGIN=http://localhost:3002
```

After role/schema approval, start the local API explicitly from the project:

```text
node --conditions=react-server --experimental-strip-types --env-file=.env.local --input-type=module -e "process.env.NODE_ENV='development'; await import('./scripts/settings-local-server.mjs')"
```

Use the normal existing app dev server at the exact configured Origin. No package scripts, deployment or shared layout changes are required. Restart both processes after configuration changes. No localStorage passwords or browser-visible DB config.

## Verification and rollback

### pgAdmin completion steps (administrator credentials unavailable to agent)

Latest completion attempt reverified the authorized DB/schema through factory_readonly: zero schema tables, settings_masters absent and factory_settings_writer absent. The three Settings environment variables were missing. A noninteractive normal psql admin preflight failed with `fe_sendauth: no password supplied`; no privileged SQL ran. Do not infer that pgAdmin's saved session supplies application/admin credentials to this process.

1. In pgAdmin, use your own existing authorized local administrator connection. Check server Properties: host **localhost**, port **5432**. Select **ionflow_inventory_dev**, then Tools → Query Tool. Do not use another database's Query Tool.
2. Run this read-only preflight; confirm both expected names and loopback address before proceeding:

```sql
SELECT current_database() AS database_name, current_user AS migration_actor,
       inet_server_addr() AS server_address, inet_server_port() AS server_port,
       to_regnamespace('inventory_sandbox') AS target_schema,
       to_regclass('inventory_sandbox.settings_masters') AS existing_settings_table;
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, rolinherit
FROM pg_catalog.pg_roles WHERE rolname='factory_settings_writer';
```

3. If the writer role exists or the Settings table exists, STOP before CREATE and inspect compatibility/effective privileges; do not recreate, drop or change ownership automatically. For a missing role, execute this exact transaction in the same authorized Query Tool:

```sql
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ionflow_inventory_dev'
     OR inet_server_port() <> 5432
     OR inet_server_addr() IS NULL
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR to_regnamespace('inventory_sandbox') IS NULL THEN
    RAISE EXCEPTION 'Wrong local development target';
  END IF;
END $$;
CREATE ROLE factory_settings_writer LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS;
COMMIT;
```

4. In pgAdmin: Login/Group Roles → factory_settings_writer → Properties → Definition, set a **new dedicated password** securely. Do not paste a password into Query Tool, Git, logs or chat. Leave administrative memberships and object ownership unset.
5. Open the project's exact `migrations/0002_settings_masters.up.sql` in the Query Tool for **ionflow_inventory_dev**; review it and execute once as the migration owner. It creates one empty Settings-owned table and its constraints/indexes only. Do not run the down migration, 0001 or any business migration implicitly. On failure issue ROLLBACK and investigate; never DROP/CASCADE to force success.
6. Only after table creation, run minimum grants (no readonly-role grants are changed):

```sql
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'ionflow_inventory_dev'
     OR inet_server_port() <> 5432
     OR inet_server_addr() IS NULL
     OR inet_server_addr() NOT IN ('127.0.0.1'::inet, '::1'::inet)
     OR to_regclass('inventory_sandbox.settings_masters') IS NULL THEN
    RAISE EXCEPTION 'Settings target/table not ready';
  END IF;
END $$;
GRANT CONNECT ON DATABASE ionflow_inventory_dev TO factory_settings_writer;
GRANT USAGE ON SCHEMA inventory_sandbox TO factory_settings_writer;
GRANT SELECT, INSERT, UPDATE ON inventory_sandbox.settings_masters TO factory_settings_writer;
COMMIT;
```

7. Keep the readonly configuration intact. Add the three Settings variables shown above to ignored `.env.local`, using the password configured locally. Set the optional app origin to the exact local app URL if not localhost:3002. The service must retain its loopback-only 127.0.0.1:4317 binding. No administrator password is required in application configuration.
8. With the Settings API **stopped** and port 4317 free, execute the opt-in integration check below. It starts/restarts only its own API child process; refuses an occupied port; creates uniquely prefixed fictional records for all 14 kinds; verifies HTTP CRUD/negative cases and direct real-DB final state. Its cleanup deactivates only records created by that run, retaining them because DELETE is intentionally disabled. It does not restart a user's Next process or claim browser refresh verification.

```text
node --conditions=react-server --experimental-strip-types --env-file=.env.local --input-type=module -e "process.env.NODE_ENV='development'; process.env.FACTORY_SETTINGS_LIVE_TEST='true'; await import('./scripts/settings-postgres.live.mjs')"
```

Only run this against the approved local target; it is **not** part of the fake-pool unit tests. No live CRUD PASS is claimed until it succeeds. Afterwards start the normal API command above, open `/settings`, save/reload a fictional master and verify the UI separately. Existing Users/Branding are outside this task.

Automated focused tests use an injected pg pool double; they are NOT PostgreSQL CRUD evidence. Actual create/read/update/deactivate/reload and application-restart durability remain BLOCKED until writer role, secret and migration-owner access are supplied. Physical delete is intentionally blocked. No browser verification is claimed.

After setup, perform the real focused flow with an explicitly fictional record: create site, read it, rename with version, reload, restart API/app, read again, deactivate and verify DB; test duplicates, stale version, invalid parent and invalid payload. Do not delete unrelated records. On DB outage, errors must remain visible with draft retained and no mock fallback.

Rollback app integration first; data is not erased. Prepared down SQL refuses populated Settings tables and drops only the empty Settings-owned table, without CASCADE. Populated state needs reviewed forward repair/export, never forced deletion. No other database or schema is touched.
