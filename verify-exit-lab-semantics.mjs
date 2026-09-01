import fs from 'node:fs';
import vm from 'node:vm';

const app=fs.readFileSync('app.js','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

need(app.includes('function exitScenarioR(o,tpR){return exitMfe(o)>=tpR?tpR:exitGrossR(o);}'),
  'G1 fixture cambió: el overlay histórico ya no tiene la semántica auditada.');
need(app.includes('Escenario · TP fijo')&&app.includes('si no lo alcanzó, se conserva la salida real'),
  'G1 fixture UI cambió: revisar clasificación del TP Overlay.');

const path='exit-lab-runtime.js';
need(fs.existsSync(path),'G1: falta exit-lab-runtime.js con TP Overlay + TP/SL first-touch.');

if(fs.existsSync(path)){
  const src=fs.readFileSync(path,'utf8');
  need(src.includes("const TR_EXIT_LAB_V31_24_VERSION='31.24.0'"),'Exit Lab runtime no está versionado V31.24.');
  need(src.includes('TP Overlay'),'El escenario híbrido no se renombró explícitamente TP Overlay.');
  need(src.includes('TP + SL Simulation'),'Falta la simulación TP + SL separada.');
  need(src.includes('unresolved'),'La simulación no conserva estado unresolved cuando ningún nivel toca.');
  need(src.includes('v314LoadTicks'),'La simulación no consume Market Data Tick.');
  need(src.includes('entryMatch')&&src.includes('exitMatch'),'La simulación no delimita la ventana de evidencia.');
  need(!src.includes('exitScenarioR(o,tpR)'), 'La simulación nueva no debe reutilizar la fórmula híbrida del overlay.');

  function extract(name){
    const start=src.indexOf('function '+name+'(');if(start<0)throw new Error('No se encuentra '+name);
    const brace=src.indexOf('{',start);let depth=0,quote='',template=false;
    for(let i=brace;i<src.length;i++){const ch=src[i],prev=src[i-1];
      if(quote){if(ch==='\\'){i++;continue;}if(ch===quote&&prev!=='\\')quote='';continue;}
      if(template){if(ch==='\\'){i++;continue;}if(ch==='\`'&&prev!=='\\')template=false;continue;}
      if(ch==="'"||ch==='"'){quote=ch;continue;}if(ch==='\`'){template=true;continue;}
      if(ch==='{')depth++;else if(ch==='}'&&--depth===0)return src.slice(start,i+1);
    }
    throw new Error('Función sin cierre: '+name);
  }
  try{
    const ctx={};vm.createContext(ctx);
    vm.runInContext(extract('trExitSimFirstTouch')+';globalThis.sim=trExitSimFirstTouch;',ctx);
    const tick=(i,last)=>[i,0,last,last-.01,last+.01,1];
    const base={direction:'LONG',entryPrice:100,entryMatch:{i:0},exitMatch:{i:3}};
    let r=ctx.sim(base,[tick(0,100),tick(1,101),tick(2,99),tick(3,100)],.25,4,1,1);
    need(r.status==='tp'&&r.resultR===1&&r.touchIndex===1,'G1 first-touch LONG: TP primero no se detectó.');
    r=ctx.sim(base,[tick(0,100),tick(1,99),tick(2,101),tick(3,100)],.25,4,1,1);
    need(r.status==='sl'&&r.resultR===-1&&r.touchIndex===1,'G1 first-touch LONG: SL primero no se detectó.');
    const short={direction:'SHORT',entryPrice:100,entryMatch:{i:0},exitMatch:{i:3}};
    r=ctx.sim(short,[tick(0,100),tick(1,99),tick(2,101),tick(3,100)],.25,4,1,1);
    need(r.status==='tp'&&r.resultR===1,'G1 first-touch SHORT: TP primero no se detectó.');
    r=ctx.sim(base,[tick(0,100),tick(1,100.5),tick(2,99.5),tick(3,100.25)],.25,4,1,1);
    need(r.status==='unresolved'&&r.resultR===null,'G1: ningún toque debe quedar unresolved, no usar salida real.');
  }catch(e){fail.push('G1 first-touch fixture: '+e.message);}
}

if(fail.length){
  console.error('Exit Lab semantics verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Exit Lab semantics verification OK');
console.log(' - historical hybrid renamed TP Overlay');
console.log(' - TP + SL Simulation is tick-based first-touch');
console.log(' - no-touch rows remain unresolved instead of inheriting actual exit');
