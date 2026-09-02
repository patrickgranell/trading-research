import fs from 'node:fs';

const source=fs.readFileSync('verify-supabase-v10-remote.mjs','utf8');
const migration=fs.readFileSync('supabase/migrations/202609010001_v31_24_cloud_v10.sql','utf8');
const migrationDir='supabase/migrations';
const laterMigrations=fs.readdirSync(migrationDir)
  .filter(name=>name.endsWith('.sql')&&name!=='202609010001_v31_24_cloud_v10.sql')
  .map(name=>({name,source:fs.readFileSync(migrationDir+'/'+name,'utf8')}));
const aclHardening=laterMigrations.find(x=>
  /revoke\s+execute\s+on\s+function\s+public\.apply_trading_workspace\s*\(\s*text\s*,\s*jsonb\s*\)\s+from\s+[^;]*anon/i.test(x.source)
  &&/service_role/i.test(x.source)
  &&/public/i.test(x.source)
  &&/grant\s+execute\s+on\s+function\s+public\.apply_trading_workspace\s*\(\s*text\s*,\s*jsonb\s*\)\s+to\s+authenticated/i.test(x.source)
);
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

need(source.includes("const RPC_PROBE_BUNDLE=null;"),'Remote gate must keep p_bundle=null.');
need(source.includes("body:JSON.stringify({p_expected_revision:'',p_bundle:RPC_PROBE_BUNDLE})"),'RPC probe body changed.');
need(source.includes("/rest/v1/trading_workspace?select=master_library&limit=0"),'Missing zero-row master_library schema probe.');
need(source.includes("/rest/v1/rpc/apply_trading_workspace"),'Missing apply_trading_workspace probe.');
need((source.match(/method:'POST'/g)||[]).length===1,'Remote gate must contain exactly one POST.');
need((source.match(/method:'GET'/g)||[]).length===1,'Remote gate must contain exactly one GET.');
need(!/method:\s*['"](?:PUT|PATCH|DELETE)['"]/i.test(source),'Remote gate contains a direct mutating HTTP method.');
need(!/p_bundle\s*:\s*(?!RPC_PROBE_BUNDLE)/.test(source.replace(/p_bundle:RPC_PROBE_BUNDLE/g,'')),'Remote gate contains another p_bundle payload.');
need(source.includes('INVALID_WORKSPACE_BUNDLE'),'Remote gate does not require the pre-DML rejection.');
need(source.includes('AUTH_REQUIRED'),'Remote gate does not distinguish a non-user token.');

const authAt=migration.indexOf("if v_user is null then");
const bundleAt=migration.indexOf("if p_bundle is null or jsonb_typeof(p_bundle) <> 'object' then");
const lockAt=migration.indexOf('pg_advisory_xact_lock');
const firstDml=Math.min(...['insert into public.trading_plans','delete from public.trading_plans','insert into public.trading_workspace'].map(x=>migration.indexOf(x)).filter(x=>x>=0));
need(authAt>=0&&bundleAt>authAt,'Migration no longer validates authenticated user then bundle.');
need(lockAt>bundleAt,'Migration moved advisory lock before invalid-bundle rejection.');
need(firstDml>bundleAt,'Migration moved DML before invalid-bundle rejection.');
need(migration.includes("raise exception 'INVALID_WORKSPACE_BUNDLE';"),'Migration lost INVALID_WORKSPACE_BUNDLE rejection.');
need(migration.includes('grant execute on function public.apply_trading_workspace(text,jsonb) to authenticated;'),'Migration no longer grants authenticated execution.');
need(!!aclHardening,'Missing follow-up ACL hardening migration: apply_trading_workspace must revoke EXECUTE from anon + service_role + PUBLIC and re-grant only authenticated.');

if(fail.length){
  console.error('Supabase V10 remote gate contract FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Supabase V10 remote gate contract OK');
console.log(' - probe payload: null bundle only');
console.log(' - HTTP surface: one zero-row GET + one aborting RPC POST');
console.log(' - migration rejects invalid bundle before lock/DML');
console.log(' - authenticated execution grant preserved');
console.log(' - follow-up ACL hardening revokes anon + service_role + PUBLIC');
