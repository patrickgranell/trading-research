const REQUIRED=['TR_SUPABASE_URL','TR_SUPABASE_ANON_KEY','TR_SUPABASE_ACCESS_TOKEN'];
const missing=REQUIRED.filter(k=>!String(process.env[k]||'').trim());
if(missing.length){
  console.error('Supabase V10 remote gate: missing environment variables: '+missing.join(', '));
  console.error('Use an authenticated USER access token. Secrets are read from the environment and never printed.');
  process.exit(2);
}

const base=String(process.env.TR_SUPABASE_URL).replace(/\/+$/,'');
const anon=String(process.env.TR_SUPABASE_ANON_KEY);
const access=String(process.env.TR_SUPABASE_ACCESS_TOKEN);
const headers={
  apikey:anon,
  Authorization:'Bearer '+access,
  Accept:'application/json'
};

function safeBody(text){
  const s=String(text||'').slice(0,1200);
  return s.replace(/[A-Za-z0-9_-]{80,}/g,'<redacted>');
}
function messageOf(text){
  try{
    const x=JSON.parse(text);
    return String(x?.message||x?.hint||x?.details||text||'');
  }catch{return String(text||'');}
}
async function request(path,options={}){
  const res=await fetch(base+path,{...options,headers:{...headers,...(options.headers||{})}});
  const text=await res.text();
  return {res,text,message:messageOf(text)};
}

// 1) Schema probe: zero-row GET. This only asks PostgREST to resolve the V10 column.
const column=await request('/rest/v1/trading_workspace?select=master_library&limit=0',{method:'GET'});
if(!column.res.ok){
  console.error('Supabase V10 remote gate FAILED');
  console.error(' - master_library column probe failed: HTTP '+column.res.status+' '+safeBody(column.text));
  process.exit(1);
}

// 2) RPC probe: deliberately invalid bundle. The installed function must reject it
// before advisory lock / SELECT FOR UPDATE / any DML. PostgreSQL rolls back the call.
const RPC_PROBE_BUNDLE=null;
const rpc=await request('/rest/v1/rpc/apply_trading_workspace',{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify({p_expected_revision:'',p_bundle:RPC_PROBE_BUNDLE})
});

if(rpc.res.ok){
  console.error('Supabase V10 remote gate FAILED');
  console.error(' - null-bundle RPC unexpectedly succeeded; refusing to treat this as a safe installation.');
  process.exit(1);
}

if(/AUTH_REQUIRED/i.test(rpc.message)){
  console.error('Supabase V10 remote gate FAILED');
  console.error(' - RPC exists, but TR_SUPABASE_ACCESS_TOKEN is not an authenticated user JWT (auth.uid() is null).');
  process.exit(1);
}
if(/permission denied|not authorized|jwt/i.test(rpc.message)&&!/INVALID_WORKSPACE_BUNDLE/i.test(rpc.message)){
  console.error('Supabase V10 remote gate FAILED');
  console.error(' - authenticated caller could not execute the RPC: HTTP '+rpc.res.status+' '+safeBody(rpc.text));
  process.exit(1);
}
if(/PGRST202|does not exist|could not find the function|schema cache/i.test(rpc.message)){
  console.error('Supabase V10 remote gate FAILED');
  console.error(' - apply_trading_workspace is not installed/exposed: HTTP '+rpc.res.status+' '+safeBody(rpc.text));
  process.exit(1);
}
if(!/INVALID_WORKSPACE_BUNDLE/i.test(rpc.message)){
  console.error('Supabase V10 remote gate FAILED');
  console.error(' - unexpected RPC probe response: HTTP '+rpc.res.status+' '+safeBody(rpc.text));
  process.exit(1);
}

console.log('Supabase V10 remote gate OK');
console.log(' - trading_workspace.master_library: exposed');
console.log(' - apply_trading_workspace(text,jsonb): installed + executable by authenticated user');
console.log(' - null-bundle rejection: INVALID_WORKSPACE_BUNDLE');
console.log(' - probe writes: 0 (function aborts before lock/DML)');
