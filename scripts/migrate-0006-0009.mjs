import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const SCHEMA = 'foliar_fertilizer';
const OWNER = 'foliar_fertilizer_owner';
const APP = 'foliar_fertilizer_app';
const MATERIAL_TABLES = ['m_material_issues', 'r_material_issue_items', 'r_material_issue_history'];
const LEGACY_MATERIAL_TABLES = ['material_issues', 'material_issue_items', 'material_issue_history'];

export function materialTablePlan(sqlNames) {
  const matches = expected => sqlNames.length === expected.length && expected.every(name => sqlNames.includes(name));
  if (matches(MATERIAL_TABLES)) return { names: [...MATERIAL_TABLES], legacySql: false };
  if (matches(LEGACY_MATERIAL_TABLES)) return { names: [...MATERIAL_TABLES], legacySql: true };
  throw new Error('0007: unrecognized CREATE TABLE names; inspect migration SQL');
}

const migrations = [
  { number: '0006', file: '0006_production_quality.up.sql', count: 6, pattern: /production_quality/ },
  { number: '0007', file: '0007_material_issues.up.sql', count: 3, pattern: /^(?:m_|r_)?material_issues?(?:_|$)/ },
  { number: '0008', file: '0008_qc_raw_material.up.sql', count: 3, pattern: /qc_raw_material/ },
  { number: '0009', file: '0009_fertilizer_powder_mixing.up.sql', count: 4, pattern: /fertilizer_powder_mixing/ },
];

export function tableNames(sql, count) {
  const names = [...sql.matchAll(/^\s*CREATE\s+TABLE\s+foliar_fertilizer\.([a-z][a-z0-9_]*)\s*\(/gim)].map(m => m[1]);
  if (names.length !== count || new Set(names).size !== count) {
    throw new Error(`Expected ${count} distinct CREATE TABLE statements; found ${names.length}`);
  }
  return names;
}

export function classify(names, relations, pattern) {
  const related = relations.filter(r => pattern.test(r.name) || names.includes(r.name));
  const unexpected = related.filter(r => !names.includes(r.name));
  const present = related.filter(r => names.includes(r.name));
  if (unexpected.length) return { status: 'CONFLICT', detail: unexpected.map(r => r.name).join(', ') };
  if (!present.length) return { status: 'PENDING', detail: 'No expected tables found' };
  if (present.some(r => r.kind !== 'r' || r.owner !== OWNER)) return { status: 'CONFLICT', detail: 'Unexpected relation type or owner' };
  if (present.length !== names.length) return { status: 'PARTIAL', detail: `${present.length}/${names.length} tables` };
  return { status: 'PRESENT', detail: `${present.length}/${names.length} tables (not migration history)` };
}

async function loadPlans() {
  return Promise.all(migrations.map(async m => {
    const sql = await readFile(new URL(`../migrations/${m.file}`, import.meta.url), 'utf8');
    if (!/^\s*(?:--[^\n]*\n\s*)*BEGIN\s*;/i.test(sql) || !/COMMIT\s*;\s*$/i.test(sql)) {
      throw new Error(`${m.file}: expected existing BEGIN/COMMIT wrapper`);
    }
    const sqlNames = tableNames(sql, m.count);
    const tablePlan = m.number === '0007' ? materialTablePlan(sqlNames) : { names: sqlNames, legacySql: false };
    return { ...m, sql, ...tablePlan };
  }));
}

async function snapshot(client, plans) {
  const { rows } = await client.query(`
    SELECT c.relname AS name, c.relkind AS kind, pg_get_userbyid(c.relowner) AS owner
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = $1 AND c.relkind IN ('r','p','v','m','f')`, [SCHEMA]);
  return plans.map(p => {
    const result = classify(p.names, rows, p.pattern);
    const detail = p.legacySql
      ? `${result.detail}; 0007 SQL uses legacy names; actual backend names checked`
      : result.detail;
    return { ...p, ...result, detail };
  });
}

async function privileges(client, plans) {
  const results = [];
  for (const plan of plans.filter(p => p.status === 'PRESENT')) {
    for (const [index, name] of plan.names.entries()) {
      const { rows: [r] } = await client.query(`SELECT
        has_table_privilege($1, $2, 'SELECT') AS s,
        has_table_privilege($1, $2, 'INSERT') AS i,
        has_table_privilege($1, $2, 'UPDATE') AS u,
        has_table_privilege($1, $2, 'DELETE') AS d,
        has_table_privilege($1, $2, 'TRUNCATE') AS t,
        has_table_privilege($1, $2, 'REFERENCES') AS ref,
        has_table_privilege($1, $2, 'TRIGGER') AS trg`, [APP, `${SCHEMA}.${name}`]);
      const history = name.endsWith('_history');
      const expectedUpdate = !history;
      const expectedDelete = index !== 0 && !history;
      const ok = r.s && r.i && r.u === expectedUpdate && r.d === expectedDelete && !r.t && !r.ref && !r.trg;
      results.push({ migration: plan.number, table: name, select: r.s, insert: r.i, update: r.u, delete: r.d, truncate: r.t, references: r.ref, trigger: r.trg, result: ok ? 'OK' : 'REVIEW' });
    }
  }
  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--apply' && args[0] !== '--check')) {
    throw new Error('Usage: npm run migration [-- --check | -- --apply]');
  }
  const apply = args[0] === '--apply';
  const plans = await loadPlans();
  if (process.env.FACTORY_DB_HOST !== '127.0.0.1' || process.env.FACTORY_DB_PORT !== '5433' || process.env.FACTORY_DB_NAME !== 'production' || process.env.FACTORY_DB_SCHEMA !== SCHEMA || process.env.FACTORY_DB_USER !== APP) {
    throw new Error('Unexpected Nan database configuration; expected local proxy, production, foliar_fertilizer');
  }
  const password = apply ? process.env.FACTORY_DB_OWNER_PASSWORD : process.env.FACTORY_DB_PASSWORD;
  if (!password) throw new Error(apply ? 'Missing FACTORY_DB_OWNER_PASSWORD' : 'Missing FACTORY_DB_PASSWORD');
  const { default: pg } = await import('pg');
  const client = new pg.Client({ host: '127.0.0.1', port: 5433, database: 'production', user: apply ? OWNER : APP, password, ssl: false, connectionTimeoutMillis: 5000, application_name: 'nan-migrations-0006-0009' });
  try {
    await client.connect();
    const { rows: [identity] } = await client.query(`SELECT current_database() AS db, current_user AS role,
      (SELECT pg_get_userbyid(nspowner) FROM pg_catalog.pg_namespace WHERE nspname = $1) AS schema_owner`, [SCHEMA]);
    if (identity.db !== 'production' || identity.role !== (apply ? OWNER : APP) || identity.schema_owner !== OWNER) throw new Error('Migration target rejected');
    console.log(`${apply ? 'APPLY' : 'CHECK'}: ${identity.db}/${SCHEMA} as ${identity.role}`);
    if (apply) {
      const { rows: [lock] } = await client.query('SELECT pg_try_advisory_lock(60009, 691) AS locked');
      if (!lock.locked) throw new Error('Another range migration runner holds the lock');
    } else {
      await client.query('BEGIN READ ONLY');
    }
    let states = await snapshot(client, plans);
    const display = list => console.table(list.map(p => ({ migration: p.number, file: p.file, status: p.status, detail: p.detail })));
    display(states);
    const grants = await privileges(client, states);
    console.table(grants);
    if (states.some(p => p.status === 'CONFLICT' || p.status === 'PARTIAL') || grants.some(r => r.result === 'REVIEW')) {
      throw new Error('Review schema conflicts/partial tables/permissions before any migration. No changes made by preflight.');
    }
    if (!apply) {
      await client.query('COMMIT');
      console.log('Read-only check complete. PRESENT is not proof of migration history or full schema equivalence.');
      return;
    }
    const pending = states.filter(p => p.status === 'PENDING');
    if (!pending.length) { console.log('No pending tables; no SQL executed.'); return; }
    // 0007 in the inspected repository has no runtime GRANT statements. Never
    // create its tables automatically without reviewed grants in the source.
    if (pending.some(p => p.number === '0007' && p.legacySql)) throw new Error('0007 SQL uses legacy names; automatic creation is blocked until reviewed.');
    if (pending.some(p => p.number === '0007' && !/\bGRANT\s+SELECT\b/i.test(p.sql))) throw new Error('0007 has no explicit SELECT grant; review its SQL before applying.');
    for (const p of pending) {
      const fresh = (await snapshot(client, plans)).find(s => s.number === p.number);
      if (fresh.status !== 'PENDING') throw new Error(`${p.number}: schema changed since preflight; stop`);
      console.log(`Applying ${p.file}`);
      await client.query(p.sql);
      states = await snapshot(client, plans);
      const result = states.find(s => s.number === p.number);
      if (result.status !== 'PRESENT') throw new Error(`${p.number}: post-commit table verification failed; inspect database`);
      const after = await privileges(client, [result]);
      if (after.some(r => r.result !== 'OK')) throw new Error(`${p.number}: committed but privilege review required; stop`);
      console.log(`${p.number}: SQL committed; table/owner/privilege checks passed`);
    }
    display(states);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error instanceof Error ? error.message : 'Migration failed'); process.exitCode = 1; });
}
