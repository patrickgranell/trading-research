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
need(runtime.includes("trEmotionalBreakdownMetric(ops,'emotion')")&&runtime.includes("trEmotionalBreakdownMetric(ops,'behavior')"),'Diario: el rediseño eliminó los análisis históricos por emoción/comportamiento.');
need(runtime.includes('trMatchingOpenSession'),'Diario: falta enlace automático a la sesión abierta del mismo entorno.');
need(runtime.includes('Backtesting queda fuera del Diario Emocional'),'Diario: la exclusión de Backtesting no se comunica en UI.');
need(structural.includes("case 'journal':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.render();"),'Diario: Structural Runtime no exige la vista de Sesiones V31.29.');
need(structural.includes("case 'journalops':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderOperations();"),'Diario: Structural Runtime no exige el Registro por operación V31.29.');
need(structural.includes("case 'journalconfidence':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderConfidence();"),'Diario: Structural Runtime no exige la vista Confianza.');
need(structural.includes("case 'journalstreaks':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderStreaks();"),'Diario: Structural Runtime no exige Rachas y adaptación.');
need(structural.includes("case 'journaldrift':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderDrift();"),'Diario: Structural Runtime no exige Deriva conductual.');
need(structural.includes("case 'journaldashboard':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderDashboard();"),'Diario: Structural Runtime no exige Dashboard emocional.');
need(structural.includes("case 'journalreflections':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderReflections();"),'Diario: Structural Runtime no exige Reflexiones.');
need(structural.includes("case 'journallibrary':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderLibrary();"),'Diario: Structural Runtime no exige Biblioteca personal.');
need(structural.includes("case 'journalnotes':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderNotes();"),'Diario: Structural Runtime no exige Notas emocionales V31.29.');
need(structural.includes("case 'journalstatements':")&&structural.includes("TradingResearchEmotionalJournalPresentationContract.renderStatements();"),'Diario: Structural Runtime no exige Dejar constancia como vista propia.');
need(runtime.includes("render:()=>trJournalSessionsRender()")&&runtime.includes("renderDashboard:()=>trJournalDashboardRender()")&&runtime.includes("renderOperations:()=>trJournalOperationsRender()")&&runtime.includes("renderConfidence:()=>trJournalConfidenceRender()")&&runtime.includes("renderStreaks:()=>trJournalStreaksRender()")&&runtime.includes("renderDrift:()=>trJournalDriftRender()")&&runtime.includes("renderReflections:()=>trJournalReflectionsRender()")&&runtime.includes("renderLibrary:()=>trJournalLibraryRender()")&&runtime.includes("renderNotes:()=>trJournalNotesRender()")&&runtime.includes("renderStatements:()=>trJournalStatementsRender()"),'Diario: Dashboard, Sesiones, Registro por operación, Confianza, Rachas, Deriva, Reflexiones, Biblioteca, Notas y Dejar constancia no están separados en presentación.');
need(runtime.includes("o?.emotional?.notes")&&runtime.includes("trSessionQuestions(plan).filter(q=>q.type==='text')"),'Diario: Notas emocionales no reúne texto de operaciones y sesiones.');
need(runtime.includes("plan.emotionalLogs")&&runtime.includes("trEarlyActions.emotionalLogOpen")&&runtime.includes("+ Nueva constancia"),'Diario: falta la entidad independiente Dejar constancia.');
need(runtime.includes("Sin preguntas ni campos adicionales")&&runtime.includes("fecha y la hora se guardan automáticamente"),'Diario: Dejar constancia ya no es el espacio libre y mínimo acordado.');
need(runtime.includes("function trJournalConfidenceRender()")&&runtime.includes("Confianza personal")&&runtime.includes("Confianza en el sistema")&&runtime.includes("Inicio → cierre"),'Diario: falta el seguimiento de confianza personal vs sistema por sesión.');
need(runtime.includes("function trJournalStreaksRender()")&&runtime.includes("Criterio de mala racha")&&runtime.includes("Racha fuera del histórico")&&runtime.includes("Drawdown real"),'Diario: falta separar racha perdedora, mala racha y drawdown real.');
need(runtime.includes("function trJournalDriftRender()")&&runtime.includes("Deriva conductual creciente")&&runtime.includes("Resultados favorables con deriva")&&runtime.includes("Microdesviaciones repetidas"),'Diario: falta la detección descriptiva de deriva conductual.');
need(runtime.includes("function trNormalizeReflection(")&&runtime.includes("function trJournalReflectionsRender()")&&runtime.includes("Conclusión que quieres conservar"),'Diario: Reflexiones no tiene entidad propia y conclusión opcional.');
need(runtime.includes("sourceType=['operation','session','statement']")&&runtime.includes("trReflectionSourceOptions")&&runtime.includes("trOpenReflectionSource"),'Diario: Reflexiones no puede vincularse opcionalmente a operación, sesión o constancia.');
need(runtime.includes("plan.emotionalReflections=reflections.filter")&&runtime.includes("tradingPlanId")&&runtime.includes("plan.emotionalReflections=[]"),'Diario: Reflexiones puede heredarse indebidamente entre Trading Plans/versiones.');
need(runtime.includes("function trNormalizeLibraryEntry(")&&runtime.includes("function trJournalLibraryRender()")&&runtime.includes("Guardar en biblioteca"),'Diario: Biblioteca personal no tiene entidad/vista propia ni promoción desde Reflexiones.');
need(runtime.includes("function trJournalDashboardRender()")&&runtime.includes("Señales para revisar")&&runtime.includes("Actividad reciente")&&runtime.includes("Racha / Drawdown"),'Diario: Dashboard 2.0 no resume los módulos emocionales acordados.');
need(runtime.includes("trDashboardSignalRows(")&&runtime.includes("no diagnostica ni prescribe")&&runtime.includes("emotionalDashboardOpen"),'Diario: Dashboard emocional no conserva su carácter descriptivo/navegable.');
need(runtime.includes("trLibraryByReflection(")&&runtime.includes("Esta reflexión ya tiene una entrada en la Biblioteca personal."),'Diario: Biblioteca personal permite duplicar la misma reflexión como varias entradas.');
need(runtime.includes("plan.emotionalLibrary=library.filter")&&runtime.includes("plan.emotionalLibrary=[]"),'Diario: Biblioteca personal puede heredarse indebidamente entre Trading Plans/versiones.');
need(runtime.includes("Buscar en la biblioteca")&&runtime.includes("trLibrarySearch"),'Diario: Biblioteca personal no permite recuperar entradas por búsqueda.');
need(runtime.includes("recent.deviations.length>=2")&&runtime.includes("delta>=25")&&runtime.includes("recent.deviations.length>=3&&recent.rate>=50"),'Diario: Deriva conductual no conserva los umbrales observacionales acordados.');
need(runtime.includes("trDriftBehaviorCounts(deviations)")&&runtime.includes("No clasifica automáticamente una etiqueta de comportamiento como buena o mala"),'Diario: comportamientos se están usando como diagnóstico en vez de contexto.');
need(runtime.includes("let trJournalResultUnit='ticks'")&&runtime.includes("[['ticks','Ticks'],['r','R'],['usd',usdLabel]]")&&runtime.includes("calcMetricStats(x,trJournalResultUnit,'net')"),'Diario: resultados no priorizan Ticks con R y US$ como alternativas.');
need(runtime.includes("function trStreakReferencePlan(")&&runtime.includes("validationGroupMembers")&&runtime.includes("referenceOps.length>=20")&&runtime.includes("trQuantile(lossLengths,.75)"),'Diario: la definición automática de mala racha no usa el Backtesting de referencia del grupo.');
need(runtime.includes("function trDrawdownEpisodes(")&&runtime.includes("opMetricValue(operation,'ticks','net')"),'Diario: Drawdown real no se calcula desde la curva acumulada en ticks netos.');
need(runtime.includes("trRelinkSessionOperations(session,plan)")&&runtime.includes("trSessionContainsOperation(session,operation)"),'Diario: guardar/editar sesiones no religa operaciones históricas por intervalo.');
need(runtime.includes("emotionalStreakCriteriaOpen")&&runtime.includes("emotionalStreakCriteriaSave")&&runtime.includes("Umbral manual"),'Diario: falta configuración manual de mala racha cuando no hay referencia suficiente.');
need(runtime.includes("function trSessionForOperation(")&&runtime.includes("function trSessionContainsOperation(")&&runtime.includes("Sin sesión emocional vinculada"),'Diario: Rachas no puede recuperar sesiones históricas por intervalo temporal.');
need(runtime.includes("TR_LOCKED_CONFIDENCE_QUESTIONS")&&runtime.includes("confidencePersonal")&&runtime.includes("confidenceSystem")&&runtime.includes("confidence-taxonomy-lock"),'Diario: las dos variables base de confianza no están protegidas frente a edición/eliminación.');
need(runtime.includes("function trJournalStatementsRender()")&&runtime.includes("renderStatements:()=>trJournalStatementsRender()"),'Diario: Dejar constancia no tiene una vista propia.');
need(runtime.includes("type=\"date\"")&&runtime.includes("type=\"week\"")&&runtime.includes("emotionalNotesFilterChange"),'Diario: Notas emocionales no permite filtrar por día/semana.');
need(runtime.includes("value=\"session\"")&&runtime.includes("value=\"operation\"")&&runtime.includes("Buscar en notas")&&!runtime.includes("value=\"standalone\""),'Diario: Notas emocionales debe filtrar solo sesiones/operaciones y excluir constancias.');
need(runtime.includes("Las constancias libres tienen su propio apartado"),'Diario: Notas emocionales no explicita la separación respecto a Dejar constancia.');
need(runtime.includes("const mode=globalThis.TradingResearchOperationSemanticsContract?.planEnvironment?.(plan)||'unclassified'"),'Diario: la sesión no hereda el entorno del Trading Plan.');
need(!runtime.includes("document.getElementById('em-session-mode')"),'Diario: el usuario todavía puede escoger manualmente el tipo de sesión.');
need(app.includes("{id:'emotional',label:'Diario emocional'")&&app.includes("['journal','◌','Sesiones']")&&app.includes("['journalops','▤','Registro por operación']")&&app.includes("['journalnotes','✎','Notas emocionales']")&&runtime.includes("['journaldashboard','◈','Dashboard emocional']")&&runtime.includes("['journalconfidence','◇','Confianza']")&&runtime.includes("['journalstreaks','≈','Rachas y adaptación']")&&runtime.includes("['journaldrift','↝','Deriva conductual']")&&runtime.includes("['journalreflections','◈','Reflexiones']")&&runtime.includes("['journallibrary','▣','Biblioteca personal']")&&runtime.includes("['journalstatements','✎','Dejar constancia']"),'Diario: navegación no contiene Dashboard emocional y el resto de módulos del Diario.');
need(app.includes("const hidden=group.id==='emotional'")&&structural.includes("emotionalGroup.hidden="),'Diario: Backtesting no oculta dinámicamente el grupo emocional.');
need(!structural.includes("TradingResearchJournalViewPresentationContract.render()"),'Diario: el router todavía puede caer silenciosamente al Diario legacy.');
need(index.indexOf('<script src="emotional-journal-runtime.js"></script>')<index.indexOf('<script src="structural-runtime.js"></script>'),'Diario: el runtime emocional debe cargarse antes que Structural Runtime.');
need(runtime.includes("['journaldashboard','journal','journalops','journalconfidence','journalstreaks','journaldrift','journalreflections','journallibrary','journalnotes','journalstatements'].includes(globalThis.TradingResearchCurrentViewReadContract?.current?.())")&&runtime.includes("setTimeout(()=>{try{window.render?.();}"),'Diario: falta repintado diferido para las vistas emocionales restauradas.');
need(!runtime.includes('journal=trJournalRender'),'Diario: persiste la reasignación frágil del renderer legacy.');
need(index.includes('<script src="emotional-journal-runtime.js"></script>'),'Diario: index no carga el runtime.');
need(build.includes("'emotional-journal-runtime.js'"),'Diario: build no empaqueta el runtime.');
need(app.includes('next.emotionalSessions=[]')&&app.includes('next.emotionalLogs=[]'),'TP Builder: el TP derivado hereda sesiones/constancias emocionales del origen.');
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
