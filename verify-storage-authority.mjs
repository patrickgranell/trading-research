import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const startToken="const STORAGE_KEY = 'tradingResearchState_v4';";
const endToken='/* ===== END V31.11 CORE ===== */';
const start=app.indexOf(startToken);
const end=start<0?-1:app.indexOf(endToken,start);
if(start<0||end<0){
  console.error('Storage authority verification FAILED');
  console.error(' - No se pudo aislar el bootstrap V31.11 en app.js.');
  process.exit(1);
}
const core=app.slice(start,end+endToken.length);
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));

async function runBootstrapCase(){
  const local=new Map();
  const writes=[];
  const document={
    documentElement:{classList:{add(){},remove(){}}},
    body:{appendChild(){}},
    getElementById(){return null;}
  };
  const context={
    console:{log(){},warn(){},error(){}},
    document,
    localStorage:{
      getItem:key=>local.has(key)?local.get(key):null,
      setItem:(key,value)=>{local.set(key,String(value));},
      removeItem:key=>{local.delete(key);}
    },
    indexedDB:{},
    state:{sentinel:'boot-state'},
    clone,
    normalizeState:clone,
    ensureAllPlansV8(){},
    ensureMasterLibrary(){},
    uid:prefix=>prefix+'-TEST',
    setTimeout(){},
    alert(){},
    addEventListener(){},
    render:undefined
  };
  vm.createContext(context);
  vm.runInContext(core,context,{filename:'app.js#storage-core'});
  context.__existing={id:'workspace',payload:{sentinel:'indexeddb-authority'}};
  context.__writes=writes;
  vm.runInContext(`
    trCoreOpenDb=async()=>({});
    trCoreGet=async(store,id)=>store===TR_CORE_STATE_STORE&&id===TR_CORE_STATE_ID?__existing:null;
    trCoreGetAll=async()=>[];
    trCoreReplaceSnapshots=async()=>true;
    trCorePersistNow=async reason=>{__writes.push({reason,state:clone(state)});return true;};
  `,context,{filename:'storage-authority-harness'});
  await vm.runInContext('trCoreBootstrap()',context);
  return {
    state:clone(context.state),
    writes:clone(writes),
    marker:local.get('tradingResearchIndexedDbState_v1')||''
  };
}

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const result=await runBootstrapCase();

need(result.state?.sentinel==='indexeddb-authority',
  'D01 reproducido: con IndexedDB válido y marker ausente, bootstrap ignoró existing.payload.');
need(result.writes?.[0]?.state?.sentinel==='indexeddb-authority',
  'D01 reproducido: bootstrap volvió a persistir el estado de arranque sobre el workspace durable.');
need(!!result.marker,
  'Tras recuperar IndexedDB sin marker debe recrearse el marker de migración.');

if(fail.length){
  console.error('Storage authority verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Storage authority verification OK');
console.log(' - IndexedDB workspace válido conserva autoridad aunque falte el migration marker');
console.log(' - La normalización/persistencia posterior conserva ese mismo workspace');
console.log(' - El marker ausente se regenera después de confirmar la escritura durable');
