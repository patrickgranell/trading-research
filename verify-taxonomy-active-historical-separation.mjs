import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('taxonomy-runtime.js','utf8');
const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

need(source.includes('function trTaxComparisonKey('),'Falta normalización semántica case/accent-insensitive para valores legacy.');
need(source.includes('function selectionOptions('),'Falta frontera explícita de opciones seleccionables activas.');
need(!source.includes('Histórico · solo consulta'),'Los filtros no deben exponer una segunda taxonomía histórica visible.');
need(!source.includes('function filterOptionGroups('),'El dominio de filtros no debe mezclar valores configurados con históricos observados.');
need(source.includes('api.selectionOptions(p,tax'),'Nueva/Editar operación no consume la frontera de opciones activas.');
need(source.includes('api.selectionOptions(p,t'),'Los filtros no consumen exclusivamente los valores configurados activos.');

const sandbox={console,structuredClone:globalThis.structuredClone};
sandbox.globalThis=sandbox;
vm.createContext(sandbox);
vm.runInContext(source,sandbox,{filename:'taxonomy-runtime.js'});
const api=sandbox.TradingResearchTaxonomyDomain;
need(!!api,'TradingResearchTaxonomyDomain no se publicó en el sandbox puro.');

if(api){
  const plan={id:'P1',setups:[],vd:[],nr:[],hypotheses:[],contextDefinitions:[],visualReferences:[]};
  api.ensurePlan(plan);
  const tax=api.taxonomyById(plan,'tradeType');
  const byName=name=>(tax.values||[]).find(v=>v.name===name);
  const rapida=byName('Rápida'),liquidez=byName('Liquidez'),otra=byName('Otra');
  need(!!rapida&&!!liquidez&&!!otra,'Tipo de operación no conserva sus tres valores canónicos iniciales.');

  const ops=[
    {id:'O1',tradingPlanId:'P1',tradeType:'LIQUIDEZ'},
    {id:'O2',tradingPlanId:'P1',tradeType:'RAPIDA'},
    {id:'O3',tradingPlanId:'P1',tradeType:'ENTRADA EN NIVEL'},
    {id:'O4',tradingPlanId:'P1',tradeType:'Liquidez'}
  ];

  need(api.resolveOperationValueId(ops[0],tax)===liquidez?.id,'LIQUIDEZ legacy debe resolver al ID canónico Liquidez.');
  need(api.resolveOperationValueId(ops[1],tax)===rapida?.id,'RAPIDA legacy debe resolver al ID canónico Rápida ignorando acento/case.');

  const selectable=api.selectionOptions(plan,tax);
  need(selectable.length===3,`Nueva operación debe ofrecer solo 3 valores activos; obtuvo ${selectable.length}.`);
  need(selectable.every(v=>['Rápida','Liquidez','Otra'].includes(v.name)),'Nueva operación contiene valores históricos no configurados.');

  const filterable=api.filterOptions(plan,tax,ops);
  need(filterable.length===3,`Filtro debe ofrecer solo los 3 valores configurados; obtuvo ${filterable.length}.`);
  need(filterable.every(v=>['Rápida','Liquidez','Otra'].includes(v.name)),'Filtro contiene valores históricos no configurados.');
  need(!filterable.some(v=>['ENTRADA EN NIVEL','RAPIDA','LIQUIDEZ'].includes(v.name)),'Valores legacy observados siguen contaminando el filtro.');
}

if(fail.length){
  console.error('Taxonomy configured-only filter gate FAILED');
  for(const x of fail)console.error(' - '+x);
  process.exit(1);
}
console.log('Taxonomy configured-only filter gate OK');
console.log(' - operation selectors expose configured active values only');
console.log(' - case/accent legacy variants still resolve to canonical IDs');
console.log(' - filters expose configured active values only; unmatched legacy values remain data, not taxonomy options');
