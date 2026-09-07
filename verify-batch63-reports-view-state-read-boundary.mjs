import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const reports=fs.readFileSync('reports-purity-runtime.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const styleAttr=fs.readFileSync('style-attr-runtime.js','utf8');
const canonical=fs.readFileSync('canonical-metrics-runtime.js','utf8');
const backup=fs.readFileSync('backup-v2-runtime.js','utf8');
const cloud=fs.readFileSync('cloud-v10-runtime.js','utf8');
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;

console.log('Batch 63 RED · Reports View State Read Boundary inventory');
console.log(` - app reportsViewState refs: ${refs(app,'reportsViewState')}`);
console.log(` - Reports Purity direct refs: ${refs(reports,'reportsViewState')}`);
console.log(` - State Runtime direct refs: ${refs(stateRuntime,'reportsViewState')}`);
console.log(` - StyleAttr labState refs (excluded): ${refs(styleAttr,'labState')}`);
console.log(` - Canonical calcStats/opMetricValue refs (excluded): ${refs(canonical,'calcStats')}/${refs(canonical,'opMetricValue')}`);
console.log(` - Backup market stores frozen: ${backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];")}`);
console.log(` - Cloud Pull currentView/render frozen: ${cloud.includes("currentView='dashboard';render();")}`);

if(!app.includes("let reportsViewState={"))throw new Error('RED inventory lost source-owned reportsViewState declaration.');
if(!app.includes("function v313SetUnit(v){reportsViewState.unit="))throw new Error('RED inventory lost source-owned Reports setters.');
if(!app.includes("reportsViewState={...reportsViewState,...clone(c)"))throw new Error('RED inventory lost full Reports state replacement semantics.');
if(refs(reports,'reportsViewState')!==22)throw new Error(`Unexpected Reports Purity reportsViewState inventory: ${refs(reports,'reportsViewState')} != 22.`);
if(refs(stateRuntime,'reportsViewState')!==2)throw new Error(`Unexpected State Runtime reportsViewState inventory: ${refs(stateRuntime,'reportsViewState')} != 2.`);
if(refs(styleAttr,'labState')!==11)throw new Error('labState exclusion drifted.');
if(refs(canonical,'calcStats')!==2||refs(canonical,'opMetricValue')!==1)throw new Error('Canonical metric exclusions drifted.');
if(!backup.includes("const TR_BACKUP_V2_MARKET_STORES=['marketMeta','marketTicks','execSets'];"))throw new Error('Backup V2 exclusion drifted.');
if(!cloud.includes("currentView='dashboard';render();"))throw new Error('Cloud Pull exclusion drifted.');

console.error('Batch 63 RED expected: 1 source-owned Reports UI state still has 24 direct runtime references and no read contract yet.');
process.exit(1);
