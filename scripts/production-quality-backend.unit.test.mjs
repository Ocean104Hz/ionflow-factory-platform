import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import ts from 'typescript';
const root='src/features/production-quality/';
const server='src/server/production-quality/';
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const url=(s)=>`data:text/javascript;base64,${Buffer.from(s).toString('base64')}`;
function compile(path,imports={}) {
  const result=ts.transpileModule(read(path),{fileName:path,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}});
  assert.deepEqual(result.diagnostics,[],path);
  let s=result.outputText.replace(/import\s+["']server-only["'];?/, '');
  for(const [specifier,target] of Object.entries(imports)) {
    const quoted=[`"${specifier}"`,`'${specifier}'`].find((x)=>s.includes(x));
    assert.ok(quoted,`${path}: ${specifier}`);
    s=s.replaceAll(quoted,JSON.stringify(target));
  }
  return url(s);
}
const profiles=compile(root+'production-quality-profiles.ts');
const domainUrl=compile(root+'production-quality-domain.ts',{'./production-quality-profiles':profiles});
const contractUrl=compile(root+'production-quality-contract.ts',{'./production-quality-domain':domainUrl});
const d=await import(domainUrl), c=await import(contractUrl);
const dbUrl=url('export function getDevelopmentDatabase(){throw new Error("unexpected real database")}');
const repoUrl=compile(server+'quality-repository.ts',{'../database/database':dbUrl,'../../features/production-quality/production-quality-domain':domainUrl,'../../features/production-quality/production-quality-contract':contractUrl});
const r=await import(repoUrl);
const authUrl=compile('src/server/auth/auth-service.ts');
const sessionUrl=url('export async function readCurrentFactoryUser(){return null}');
const serviceUrl=compile(server+'quality-service.ts',{'../auth/auth-service':authUrl,'../auth/server-auth':sessionUrl,'../../features/production-quality/production-quality-contract':contractUrl,'./quality-repository':repoUrl});
const {createQualityService}=await import(serviceUrl);
const id='2c11aa33-34f2-4c68-94a7-c7ab5831c7dd';
const actor={id:'test-actor',displayName:'Test operator'};
const input=()=>c.parseQualityInput({...d.blankInspection(),readings:{percent_retained_5mm:{'09:00':{kind:'numeric',value:'-',note:'dash'}},water_solubility:{'09:00':{kind:'duration',value:'00:00',note:''}},operator_presence:{'09:00':{kind:'boolean',value:false,note:''}},dryer_temperature_group_a:{'09:00':{kind:'temperature',value:['20','','0',''],note:'partial'}},bulk_density:{'09:00':{kind:'numeric',value:'',note:'note only'}}}});
const dbRow=(payload=input(),version='1')=>({...payload,id,version,createdAt:new Date('2026-11-25T01:00:00Z'),updatedAt:new Date('2026-11-25T01:00:00Z'),signers:payload.signers.map((s,i)=>({role_code:c.signerCodes[i],signer_name:s.name,signed_date:s.date||null})),readings:r.readingRows(payload)});
function fakeDb({version='1',old=input(),saved=input(),failAudit=false}={}) {
  const calls=[];let selects=0,commits=0,rollbacks=0;
  const q={async query(sql,values=[]){calls.push({sql,values});if(sql.includes('FOR UPDATE'))return [{version}];if(sql.startsWith('SELECT h.id'))return [dbRow(selects++===0?old:saved,selects===1?version:String(Number(version)+1))];if(sql.startsWith('UPDATE'))return [{id,version:String(Number(version)+1)}];if(failAudit&&sql.includes('INSERT INTO foliar_fertilizer.r_production_quality_history'))throw Error('audit failure');return [];}};
  return {calls,get commits(){return commits},get rollbacks(){return rollbacks},readOnly:async(work)=>work(q),write:async(work)=>{try{const v=await work(q);commits++;return v}catch(e){rollbacks++;throw e}}};
}
test('request allowlist ignores client audit metadata; validates status and field types',()=>{
  const p=c.parseQualityInput({...d.blankInspection(),id,version:'900',createdAt:'spoof',updatedAt:'spoof'});
  assert.equal('id' in p,false);assert.equal('version' in p,false);assert.equal('createdAt' in p,false);
  for(const patch of [{recordStatus:'APPROVED'},{profileId:'OTHER'},{readings:{unknown:{}}},{readings:{operator_presence:{'09:00':{kind:'boolean',value:'false',note:''}}}},{signers:[]},{stops:[{id:'',stop:'',restart:'',reason:''}]}])assert.throws(()=>c.parseQualityInput({...d.blankInspection(),...patch}),c.QualityValidationError);
});
test('domain validation rejects incomplete recorded report, invalid date, wrong plant line and duplicate slots',()=>{
  for(const patch of [{recordStatus:'RECORDED'},{inspectionDate:'2026-02-30'},{productionLine:'F1'},{formulas:[{...d.blankFormula('f'),extraSlots:['09:00','09:00']}]}])assert.throws(()=>c.parseQualityInput({...d.blankInspection(),...patch}),c.QualityValidationError);
  assert.throws(()=>c.readVersion('0'));assert.throws(()=>c.readVersion('9223372036854775808'));assert.throws(()=>c.readId('demo-id'));
});
test('typed reading round trip preserves dash, zero, false, partial temperature, and note-only cells',()=>{
  const p=input(),mapped=r.mapQualityRecord(dbRow(p));
  assert.deepEqual(mapped.readings,p.readings);assert.deepEqual(mapped.signers,p.signers);assert.equal(mapped.version,'1');
  const rows=r.readingRows(p);assert.equal(rows.find(x=>x.metric_code==='percent_retained_5mm').numeric_value,0);assert.equal(rows.find(x=>x.metric_code==='operator_presence').boolean_value,false);assert.deepEqual(rows.find(x=>x.metric_code==='dryer_temperature_group_a').temperature_values,[20,null,0,null]);
});
test('create writes header, four child sets and audit in a single write transaction',async()=>{
  const db=fakeDb(),rec=await r.createQualityRepository(db).create(input(),actor);assert.equal(rec.version,'1');assert.equal(db.commits,1);assert.equal(db.rollbacks,0);
  const writes=db.calls.filter(x=>x.sql.startsWith('INSERT'));assert.equal(writes.length,6);assert.match(writes.at(-1).sql,/r_production_quality_history/);assert.equal(writes.at(-1).values[4],actor.id);assert.ok(writes.every(x=>x.values.length>0));
});
test('audit failure propagates and transaction boundary rolls back',async()=>{
  const db=fakeDb({failAudit:true});await assert.rejects(r.createQualityRepository(db).create(input(),actor),/audit failure/);assert.equal(db.commits,0);assert.equal(db.rollbacks,1);
});
test('stale version stops before any mutation',async()=>{
  const db=fakeDb({version:'2'});await assert.rejects(r.createQualityRepository(db).update(id,'1',input(),actor),r.QualityConflictError);assert.equal(db.calls.length,1);assert.equal(db.commits,0);
});
test('saved profile cannot be switched; recorded cannot return to draft',async()=>{
  let db=fakeDb();await assert.rejects(r.createQualityRepository(db).update(id,'1',{...input(),profileId:'IFOAM'},actor),r.QualityConflictError);assert.equal(db.calls.filter(x=>x.sql.startsWith('UPDATE')).length,0);
  const recorded=c.parseQualityInput({...input(),recordStatus:'RECORDED',inspectionDate:'2026-11-25',documentNumber:'QC-TEST',productionSite:'Test',productionLine:'T1',formulas:[{...d.blankFormula('f'),formulaName:'A',lotCode:'LOT'}]});db=fakeDb({old:recorded});await assert.rejects(r.createQualityRepository(db).update(id,'1',input(),actor),r.QualityConflictError);
});
test('update replaces only child rows for one inspection and records the next version',async()=>{
  const p={...input(),notes:'edited'},db=fakeDb({saved:p});const rec=await r.createQualityRepository(db).update(id,'1',p,actor);assert.equal(rec.version,'2');assert.equal(rec.notes,'edited');assert.equal(db.calls.filter(x=>x.sql.startsWith('DELETE FROM')).length,4);assert.ok(db.calls.filter(x=>x.sql.startsWith('DELETE FROM')).every(x=>x.values[0]===id&&/WHERE inspection_id=\$1/.test(x.sql)));assert.equal(db.commits,1);
});
test('archive keeps children and writes append-only history',async()=>{
  const db=fakeDb();await r.createQualityRepository(db).archive(id,'1',actor);assert.equal(db.calls.filter(x=>x.sql.startsWith('DELETE')).length,0);assert.ok(db.calls.some(x=>x.sql.includes('SET archived_at=')));assert.equal(db.calls.at(-1).values[3],'archived');assert.equal(db.commits,1);
});
test('service blocks unauthenticated, wrong module and wrong role before repository access',async()=>{
  for(const user of [null,{...actor,modules:[],roles:['factory_admin']},{...actor,modules:['production_quality'],roles:[]}]){let hits=0;const s=createQualityService({readUser:async()=>user,getRepository:()=>{hits++;throw Error('repository called')}});await assert.rejects(s.list(),e=>e.status===401||e.status===403);assert.equal(hits,0);}
});
test('service uses authenticated actor and version, not spoofed input',async()=>{
  let args;const s=createQualityService({readUser:async()=>({...actor,modules:['production_quality'],roles:['factory_admin']}),getRepository:()=>({update:async(...v)=>{args=v;return {}}})});await s.update(id,{...input(),version:'3',actor:{id:'spoof'}});assert.equal(args[0],id);assert.equal(args[1],'3');assert.deepEqual(args[3],actor);assert.equal('actor' in args[2],false);
});
test('scoped strict TypeScript checks API, repository, service and quality feature sources',()=>{
  const base=fileURLToPath(new URL('../',import.meta.url));
  const config=ts.parseJsonConfigFileContent(JSON.parse(read('tsconfig.json')),ts.sys,base);
  const files=[server+'quality-repository.ts',server+'quality-service.ts','app/api/production-quality/route.ts',root+'production-quality-api.ts',root+'production-quality-contract.ts',root+'production-quality-provider.tsx',root+'production-quality-form.tsx',root+'production-quality-history.tsx',root+'production-quality-workspace.tsx',root+'production-quality-domain.ts',root+'production-quality-print.ts'].map(p=>fileURLToPath(new URL('../'+p,import.meta.url)));
  const program=ts.createProgram(files,{...config.options,noEmit:true,incremental:false});
  const diagnostics=files.flatMap(file=>[...program.getSyntacticDiagnostics(program.getSourceFile(file)),...program.getSemanticDiagnostics(program.getSourceFile(file))]);
  assert.equal(diagnostics.length,0,ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>base,getCanonicalFileName:f=>f,getNewLine:()=>"\n"}));
});
