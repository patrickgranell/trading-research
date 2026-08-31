import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

function extractFunction(src,name){
  const variants=['async function '+name+'(','function '+name+'('];let start=-1;
  for(const v of variants){start=src.indexOf(v);if(start>=0)break;}
  if(start<0)throw new Error('No se encuentra '+name);
  const brace=src.indexOf('{',start);let depth=0,quote='',template=false;
  for(let i=brace;i<src.length;i++){const c=src[i],p=src[i-1];
    if(quote){if(c==='\\'){i++;continue;}if(c===quote&&p!=='\\')quote='';continue;}
    if(template){if(c==='\\'){i++;continue;}if(c==='`'&&p!=='\\')template=false;continue;}
    if(c==="'"||c==='"'){quote=c;continue;}if(c==='`'){template=true;continue;}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return src.slice(start,i+1);
  }
  throw new Error('Función sin cierre: '+name);
}

const context={
  state:{settings:{instruments:[]}},
  uid:(p)=>p+'-'+(++context.uidN),uidN:0,
  nnum:v=>{const n=Number(v);return Number.isFinite(n)?n:0;},
  riskCalc:()=>null,
  instrumentSnapshot:()=>null,
  planSnapshot:()=>({}),
  strategySnapshot:()=>null,
  clone:v=>JSON.parse(JSON.stringify(v))
};
vm.createContext(context);
try{
  vm.runInContext(extractFunction(app,'operationFromDraft')+';globalThis.__make=operationFromDraft;',context);
  const plan={id:'PLAN',name:'Plan',version:1,riskStrategies:[]};
  const draft={instrumentId:'',symbol:'MNQ',riskStrategyId:'',contracts:1,resultTicks:5,stopTicks:10,src:{TPCompliance:'True'},line:'same raw row',rowIndex:1,entryDate:'2026-01-01T10:00',exitDate:'2026-01-01T10:05',direction:'LONG',contract:'MNQ 03-26',timeframe:'5m',setup:'A',vd:'V',nr:'N',hypothesis:'H1',h4Context:'CTX',tradeType:'T',notes:'',entryType:'MARKET',entryPrice:100,lots:[],possibleUpdate:false};
  const a=context.__make(draft,plan,'B1'),b=context.__make(draft,plan,'B2');
  need(a.id===b.id,`D10 reproduction: exact same Ankora row receives new IDs (${a.id} vs ${b.id}).`);
}catch(e){fail.push('D10 reproduction fixture falló: '+e.message);}

need(app.includes('function ankoraSourceFingerprint('),'D10: falta fingerprint estable de fuente Ankora.');
need(app.includes('function ankoraClassifyPreviewDrafts('),'D10: falta clasificación contra operaciones persistidas.');
need(app.includes("importDisposition:'insert'"),'D10: draft no declara política insert/update/skip/conflict.');
need(app.includes('sourceFingerprint'),'D10: fingerprint no se persiste con la operación.');
need(!app.includes('state.operations.push(...rows);'),'D10: confirmación sigue insertando todas las filas ciegamente.');

if(fail.length){
  console.error('Ankora idempotency verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Ankora idempotency verification OK');
