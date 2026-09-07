import fs from 'node:fs';
import vm from 'node:vm';

const file='taxonomy-runtime.js';
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(fs.existsSync(file),'Batch 65 RED: falta taxonomy-runtime.js; todavía no existe un dominio configurable de taxonomías.');

if(fs.existsSync(file)){
  const src=fs.readFileSync(file,'utf8');
  need(src.includes('TradingResearchTaxonomyDomain'),'Batch 65: falta el API público de dominio de taxonomías.');
  need(src.includes('taxonomyRegistry'),'Batch 65: el Trading Plan no publica un registry durable de taxonomías.');
  need(src.includes('taxonomyValues'),'Batch 65: las operaciones no almacenan clasificaciones por ID estable.');
  need(src.includes('taxonomyFilters'),'Batch 65: falta el estado de filtros dinámicos compartido.');
  need(src.includes('tradeType'),'Batch 65: Tipo de operación no se integra como taxonomía core.');
  need(src.includes('operationForm'),'Batch 65: el formulario de operación no consume taxonomías dinámicas.');
  need(src.includes('saveOperationFromForm'),'Batch 65: el guardado de operación no persiste taxonomías dinámicas.');
  need(src.includes('operationsFilterPanel'),'Batch 65: Operaciones no expone filtros dinámicos.');
  need(src.includes('labFilterPanel'),'Batch 65: Laboratorio no expone filtros dinámicos.');
  need(src.includes('baseFilteredOps'),'Batch 65: el pipeline compartido de filtros no consume taxonomías.');
  need(src.includes('dimensionItem'),'Batch 65: el desglose analítico no admite taxonomías como dimensión.');

  const ctx={console};
  vm.createContext(ctx);
  try{vm.runInContext(src,ctx,{filename:file});}
  catch(e){fail.push(`Batch 65: taxonomy-runtime.js no puede cargarse como dominio puro en Node VM: ${e.message}`);}
  const api=ctx.TradingResearchTaxonomyDomain;
  if(api){
    const plan={
      id:'TP_TEST',setups:['S1'],vd:['VD1'],nr:['NR1'],
      hypotheses:[{id:'H1',name:'Continuación',description:''}],
      contextDefinitions:[{id:'CTX1',key:'EA Norm',title:'EA Norm'}]
    };
    api.ensurePlan(plan);
    const ids=plan.taxonomyRegistry.map(t=>t.id);
    for(const id of ['setup','vd','nr','hypothesis','context','tradeType'])need(ids.includes(id),`Batch 65: falta taxonomía core ${id}.`);
    const tt=api.taxonomyById(plan,'tradeType');
    need(tt?.values?.some(v=>v.name==='Rápida')&&tt?.values?.some(v=>v.name==='Liquidez')&&tt?.values?.some(v=>v.name==='Otra'),
      'Batch 65: Tipo de operación no migra los valores históricos por defecto.');

    const oldOp={id:'O1',tradingPlanId:'TP_TEST',tradeType:'Rápida',setup:'S1',vd:'VD1',nr:'NR1',hypothesis:'H1',h4Context:'EA Norm'};
    const before=api.resolveOperationValueId(oldOp,tt);
    need(!!before,'Batch 65: una operación legacy no resuelve Tipo de operación a un ID estable.');
    if(before){
      api.renameValue(plan,'tradeType',before,'Rápida de apertura');
      const after=api.resolveOperationValueId(oldOp,api.taxonomyById(plan,'tradeType'));
      need(after===before,'Batch 65: renombrar un valor rompe la clasificación histórica; falta alias estable.');
    }

    api.archiveTaxonomy(plan,'tradeType',true);
    need(!api.activeTaxonomies(plan).some(t=>t.id==='tradeType'),'Batch 65: una taxonomía archivada sigue activa en nuevos formularios/filtros.');
    need(api.resolveOperationValueId(oldOp,api.taxonomyById(plan,'tradeType'))===before,
      'Batch 65: archivar una taxonomía destruye su resolución histórica.');
    api.archiveTaxonomy(plan,'tradeType',false);

    api.createTaxonomy(plan,{id:'custom-confirmation',name:'Confirmación'});
    api.addValue(plan,'custom-confirmation',{id:'cv-break',name:'Rotura'});
    const customOp={id:'O2',tradingPlanId:'TP_TEST',taxonomyValues:{'custom-confirmation':'cv-break'}};
    need(api.matchesFilters(customOp,plan,{'custom-confirmation':'cv-break'}),'Batch 65: el filtro dinámico no incluye la operación clasificada.');
    need(!api.matchesFilters(customOp,plan,{'custom-confirmation':'otro'}),'Batch 65: el filtro dinámico no excluye valores distintos.');
    need(api.canDeleteTaxonomy(plan,'custom-confirmation',[customOp])===false,
      'Batch 65: permite borrar definitivamente una taxonomía custom todavía referenciada por histórico.');
    need(api.deleteTaxonomy(plan,'custom-confirmation',[customOp])===false,
      'Batch 65: el borrado definitivo elimina silenciosamente datos históricos.');
    need(api.canDeleteTaxonomy(plan,'custom-confirmation',[])===true,
      'Batch 65: una taxonomía custom sin referencias no puede borrarse definitivamente.');
  }
}

if(fail.length){
  console.error('\nConfigurable Taxonomy Domain V31.26 verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}
console.log('Configurable Taxonomy Domain V31.26 verification OK');
console.log(' - stable IDs + historical aliases');
console.log(' - archive != destructive delete');
console.log(' - Tipo de operación is configurable core taxonomy');
console.log(' - Operations/Lab share dynamic taxonomy filters');
console.log(' - taxonomy dimensions feed analytical breakdown');
