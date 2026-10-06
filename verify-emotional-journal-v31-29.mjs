import fs from 'node:fs';
import vm from 'node:vm';

const runtime=fs.readFileSync('emotional-journal-runtime.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const structural=fs.readFileSync('structural-runtime.js','utf8');
const index=fs.readFileSync('index.html','utf8');
const build=fs.readFileSync('build.mjs','utf8');
const fail=[];
const need=(c,m)=>{if(!c)fail.push(m);};

need(runtime.includes("TR_SESSION_MODES=Object.freeze(['replay','sim','live'])"),'Diario: los modos de sesión no son Replay/SIM/Live.');
need(runtime.includes("return trOperationLayer(operation)!=='backtest'"),'Diario: Backtesting no es la única exclusión explícita.');
need(runtime.includes('emotionalSessions'),'Diario: falta almacenamiento durable de sesiones dentro del Trading Plan.');
need(runtime.includes('confidencePersonal')&&runtime.includes('confidenceSystem'),'Diario: falta separar confianza personal y confianza en el sistema.');
need(runtime.includes("TR_TRI_LEVELS=Object.freeze(['low','medium','high'])"),'Diario: estrés/foco/fatiga/desgaste no usan la escala simple acordada.');
need(runtime.includes("TR_CONFIDENCE_LEVELS=Object.freeze(['very_low','low','normal','high','very_high'])"),'Diario: las dos confianzas no conservan cinco niveles ordinales.');
need(runtime.includes('Sin informar'),'Diario: falta estado explícito de dato ausente.');
need(runtime.includes('journalSessionId'),'Diario: las operaciones no pueden vincularse a una sesión.');
need(runtime.includes("emotionalBreakdown(ops,'emotion')")&&runtime.includes("emotionalBreakdown(ops,'behavior')"),'Diario: el rediseño eliminó los análisis históricos por emoción/comportamiento.');
need(runtime.includes('trMatchingOpenSession'),'Diario: falta enlace automático a la sesión abierta del mismo entorno.');
need(runtime.includes('Backtesting queda fuera del Diario Emocional'),'Diario: la exclusión de Backtesting no se comunica en UI.');
need(structural.includes("case 'journal': return globalThis.TradingResearchEmotionalJournalPresentationContract?.render?.()||globalThis.TradingResearchJournalViewPresentationContract.render();"),'Diario: Structural Runtime no prioriza la nueva vista V31.29.');
need(runtime.includes("TradingResearchCurrentViewReadContract?.current?.()==='journal'")&&runtime.includes("setTimeout(()=>{try{window.render?.();}"),'Diario: falta repintado diferido cuando Journal fue restaurado antes de cargar V31.29.');
need(!runtime.includes('journal=trJournalRender'),'Diario: persiste la reasignación frágil del renderer legacy.');
need(index.includes('<script src="emotional-journal-runtime.js"></script>'),'Diario: index no carga el runtime.');
need(build.includes("'emotional-journal-runtime.js'"),'Diario: build no empaqueta el runtime.');
need(app.includes('next.emotionalSessions=[]'),'TP Builder: el TP derivado hereda sesiones emocionales del origen.');
need(app.includes("sourceJournalSessionId=x.journalSessionId||'';x.journalSessionId=''"),'TP Builder: operaciones derivadas conservan un journalSessionId ajeno.');

const ctx={console,window:null};
ctx.window=ctx;
ctx.TradingResearchOperationSemanticsContract={
  layer(o){return o?.layer||'unclassified';}
};
vm.createContext(ctx);
try{vm.runInContext(runtime,ctx,{filename:'emotional-journal-runtime.js'});}
catch(e){fail.push('Diario: el dominio puro no carga en VM: '+e.message);}
const api=ctx.TradingResearchEmotionalJournalDomain;
if(api){
  need(api.operationEligible({layer:'backtest'})===false,'Diario: backtest aparece como elegible.');
  for(const layer of ['replay','sim','live','pending','unclassified'])need(api.operationEligible({layer})===true,`Diario: ${layer} fue excluido aunque solo Backtesting debe quedar fuera.`);
  const p=api.normalizePoint({confidencePersonal:'high',confidenceSystem:'low',stress:'medium',focus:'high',fatigue:'low',emotionalWear:'medium'});
  need(p.confidencePersonal==='high'&&p.confidenceSystem==='low'&&p.stress==='medium','Diario: normalización de escalas categóricas inválida.');
  const empty=api.normalizePoint({stress:'',focus:'',confidencePersonal:''});
  need(empty.stress===''&&empty.focus===''&&empty.confidencePersonal==='','Diario: dato ausente se transforma en una respuesta categórica.');
  const plan={id:'P1'};
  api.ensurePlan(plan);
  need(Array.isArray(plan.emotionalSessions)&&plan.emotionalSessions.length===0,'Diario: un TP legacy no recibe sesiones vacías de forma segura.');
  const cov=api.coverage([{id:'B',layer:'backtest'},{id:'L',layer:'live',emotional:true},{id:'S',layer:'sim'}],o=>!!o.emotional);
  need(cov.total===2&&cov.done===1&&cov.pct===50,'Diario: cobertura no excluye Backtesting del denominador.');
}

if(fail.length){
  console.error('\nEmotional Journal V31.29 verification FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Emotional Journal V31.29 verification OK');
console.log(' - Backtesting excluded; Replay/SIM/Live execution eligible');
console.log(' - session can exist with zero trades');
console.log(' - confidence split + low/medium/high subjective scales');
console.log(' - missing value stays unknown');
console.log(' - derived TP detaches session identity');
