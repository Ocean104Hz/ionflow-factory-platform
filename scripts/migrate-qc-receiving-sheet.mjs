import { readFile } from "node:fs/promises";
import pg from "pg";
const mode=process.argv[2];
const apply=mode==="--apply";
if (!(mode==="--check" && process.argv.length===3) && !(apply && process.argv.length===4 && process.argv[3]==="--backup-verified")) throw new Error("Usage: node --env-file=.env.local scripts/migrate-qc-receiving-sheet.mjs --check | --apply --backup-verified");
const e=process.env, schema="foliar_fertilizer",owner="foliar_fertilizer_owner",app="foliar_fertilizer_app";
if(e.FACTORY_DB_HOST!=="127.0.0.1"||e.FACTORY_DB_PORT!=="5433"||e.FACTORY_DB_NAME!=="production"||e.FACTORY_DB_SCHEMA!==schema||e.FACTORY_DB_USER!==app) throw new Error("Unexpected database target; stop. Expected Nan production via local proxy 127.0.0.1:5433");
const password=apply?e.FACTORY_DB_OWNER_PASSWORD:e.FACTORY_DB_PASSWORD;
if(!password)throw new Error("Required local database credential is missing");
const client=new pg.Client({host:"127.0.0.1",port:5433,database:"production",user:apply?owner:app,password,ssl:false,connectionTimeoutMillis:5000,application_name:"nan-qc-receiving-sheet-migration"});
const names=["m_qc_receiving_sheet","r_qc_receiving_sheet_lines","r_qc_receiving_sheet_history","qc_receiving_document_numbers"];
const legacy=["m_qc_raw_material","r_qc_raw_material_checks","r_qc_raw_material_history"];
async function inspect(){
 const {rows}=await client.query(`SELECT c.relname AS name,c.relkind AS kind,pg_get_userbyid(c.relowner) AS owner FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2::text[])`,[schema,[...names,...legacy]]);
 for(const name of legacy)if(!rows.some(r=>r.name===name&&r.kind==="r"&&r.owner===owner))throw new Error(`Legacy table missing or wrong owner: ${name}`);
 const present=rows.filter(r=>names.includes(r.name));
 if(present.some(r=>r.kind!=="r"||r.owner!==owner))throw new Error("Unexpected receiving sheet object owner/type");
 const {rows:triggers}=await client.query(`SELECT c.relname AS relation,t.tgname AS name,t.tgenabled AS enabled,p.proname AS function FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_proc p ON p.oid=t.tgfoid WHERE n.nspname=$1 AND t.tgname IN ('qc_receiving_reserve_legacy_number','qc_receiving_reserve_paper_number') AND NOT t.tgisinternal`,[schema]);
 const {rows:[fn]}=await client.query(`SELECT count(*)::int AS count FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 AND p.proname='qc_receiving_reserve_number'`,[schema]);
 if(present.length===0&&triggers.length===0&&fn.count===0)return "PENDING";
 if(present.length!==4||triggers.length!==2||fn.count!==1||!triggers.some(t=>t.relation===legacy[0]&&t.name==="qc_receiving_reserve_legacy_number"&&t.enabled==="O"&&t.function==="qc_receiving_reserve_number")||!triggers.some(t=>t.relation===names[0]&&t.name==="qc_receiving_reserve_paper_number"&&t.enabled==="O"&&t.function==="qc_receiving_reserve_number"))throw new Error("PARTIAL/CONFLICT: do not apply; inspect DB");
 for(const name of names){
  for(const p of ["SELECT","INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES","TRIGGER"]){
   const expected=(name!==names[3]&&["SELECT","INSERT"].includes(p))||(p==="UPDATE"&&[names[0],names[1]].includes(name))||(p==="DELETE"&&name===names[1]);
   const {rows:[r]}=await client.query("SELECT has_table_privilege($1,$2,$3) AS valid",[app,`${schema}.${name}`,p]);
   if(r.valid!==expected)throw new Error(`Privilege mismatch: ${name} ${p}`);
  }
 }
 if(apply){
  const {rows:[r]}=await client.query(`SELECT NOT EXISTS (
    (SELECT lower(btrim(document_number)) AS number,id,'legacy'::text AS kind FROM foliar_fertilizer.m_qc_raw_material UNION ALL SELECT lower(btrim(document_number)),id,'paper'::text FROM foliar_fertilizer.m_qc_receiving_sheet)
    EXCEPT SELECT normalized_number,document_id,document_kind FROM foliar_fertilizer.qc_receiving_document_numbers
  ) AND NOT EXISTS (
    SELECT normalized_number,document_id,document_kind FROM foliar_fertilizer.qc_receiving_document_numbers EXCEPT (SELECT lower(btrim(document_number)),id,'legacy'::text FROM foliar_fertilizer.m_qc_raw_material UNION ALL SELECT lower(btrim(document_number)),id,'paper'::text FROM foliar_fertilizer.m_qc_receiving_sheet)
  ) AS valid`);
  if(!r.valid)throw new Error("Document-number registry mismatch");
 }
 return "PRESENT";
}
try{
 await client.connect();
 const {rows:[identity]}=await client.query(`SELECT current_database() AS db,current_user AS role,(SELECT pg_get_userbyid(nspowner) FROM pg_catalog.pg_namespace WHERE nspname=$1) AS schema_owner`,[schema]);
 if(identity.db!=="production"||identity.role!==(apply?owner:app)||identity.schema_owner!==owner)throw new Error("Migration target rejected");
 console.log(`${apply?"APPLY":"CHECK"}: production/${schema} as ${identity.role}`);
 if(apply){const {rows:[r]}=await client.query("SELECT pg_try_advisory_lock(60009,691) AS locked");if(!r.locked)throw new Error("Another migration holds lock");}else await client.query("BEGIN READ ONLY");
 const state=await inspect();console.log(state);
 if(apply&&state==="PENDING"){
  await client.query(await readFile(new URL("../migrations/0011_qc_receiving_sheet.up.sql",import.meta.url),"utf8"));
  if(await inspect()!=="PRESENT")throw new Error("Post-commit verification failed; inspect database before retrying");
  console.log("APPLIED: tables, triggers, privileges and number registry verified.");
 }else if(!apply){await client.query("COMMIT");console.log("Read-only check; no migration executed.");}else console.log("Already present; no SQL executed.");
}catch(error){await client.query("ROLLBACK").catch(()=>undefined);console.error(error instanceof Error?error.message:"Migration failed");process.exitCode=1;}finally{await client.end().catch(()=>undefined);}
