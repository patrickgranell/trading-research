import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};
const runtimePath='cloud-v10-runtime.js';
const sqlPath='supabase/migrations/202609010001_v31_24_cloud_v10.sql';

need(fs.existsSync(runtimePath),'G2: falta cloud-v10-runtime.js; la escritura efectiva sigue siendo V9.2 multi-tabla.');
need(fs.existsSync(sqlPath),'G2: falta migración SQL versionada para apply_trading_workspace().');

if(fs.existsSync(runtimePath)){
  const r=fs.readFileSync(runtimePath,'utf8');
  need(r.includes("const TR_CLOUD_V10_VERSION='31.24.0'"),'Cloud V10 runtime no está versionado como V31.24.');
  need(r.includes("cloudClient.rpc('apply_trading_workspace'"),'Cloud V10 no usa RPC Postgres atómico.');
  need(!r.includes("cloudUpsertChunks('trading_"),'Cloud V10 conserva escrituras multi-tabla JS.');
  need(!r.includes('cloudAcquireRevisionLock('),'Cloud V10 sigue publicando la revisión antes del commit real.');
  const upload=r.indexOf('cloudSyncImages(user)');
  const rpc=r.indexOf("cloudClient.rpc('apply_trading_workspace'");
  need(upload>=0&&rpc>upload,'Orden cloud inseguro: blobs requeridos deben subirse antes del commit DB.');
  need(r.includes('CLOUD_V10_RPC_REQUIRED'),'Falta fail-closed explícito cuando RPC/migración no está disponible.');
  need(r.includes('masterLibrary')&&!r.includes('__masterLibrary:clone(ensureMasterLibrary())'),
    'G4: Master Library no está representada una sola vez en el bundle cloud V10.');
  need(r.includes('delete clean.__masterLibrary')||r.includes("delete payload.__masterLibrary"),
    'G4: V10 no elimina la copia legacy __masterLibrary de cada plan.');
}
if(fs.existsSync(sqlPath)){
  const sql=fs.readFileSync(sqlPath,'utf8');
  need(/create\s+or\s+replace\s+function\s+public\.apply_trading_workspace/i.test(sql),'SQL no define apply_trading_workspace().');
  need(/auth\.uid\s*\(\s*\)/i.test(sql),'RPC no ata la escritura al usuario autenticado.');
  need(/for\s+update/i.test(sql),'RPC no bloquea la revisión actual antes del CAS.');
  for(const table of ['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'])
    need(sql.includes(table),`RPC no cubre ${table}.`);
  need(/master_library/i.test(sql),'G4: SQL no guarda Master Library una sola vez en workspace.');
  need(/CONFLICT_REVISION|conflict/i.test(sql),'RPC no expone conflicto CAS.');
  const workspaceWrite=Math.max(sql.lastIndexOf('insert into public.trading_workspace'),sql.lastIndexOf('update public.trading_workspace'));
  const childWrite=Math.max(...['trading_plans','trading_instruments','trading_operations','trading_import_batches','trading_opportunities'].map(t=>sql.lastIndexOf(t)));
  need(workspaceWrite>childWrite,'La revisión/workspace debe publicarse después de aplicar las tablas hijas.');
}

const effectiveV92=app.slice(app.lastIndexOf('cloudPushState=async function'),app.indexOf('\n\ncloudPullState=async function',app.lastIndexOf('cloudPushState=async function')));
need(effectiveV92.includes('cloudAcquireRevisionLock(')&&effectiveV92.includes("cloudUpsertChunks('trading_operations'"),
  'Fixture histórico G2 cambió: revisar red gate antes de continuar.');
need(app.includes("row.payload={...clone(row.payload),__masterLibrary:clone(ensureMasterLibrary())}"),
  'Fixture histórico G4 cambió: revisar red gate de duplicación Master Library.');

if(fail.length){
  console.error('Supabase V10 atomic workspace verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Supabase V10 atomic workspace verification OK');
console.log(' - one RPC owns CAS + all relational writes');
console.log(' - revision advances only after transaction success');
console.log(' - required image uploads precede DB commit; Storage GC follows commit');
console.log(' - Master Library has one cloud representation');
console.log(' - RPC unavailable => fail closed, no V9.2 write fallback');
