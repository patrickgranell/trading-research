import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];
const runtimeSources=new Map(runtimeFiles.map(file=>[file,fs.readFileSync(file,'utf8')]));
const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];
const refs=(src,name)=>(src.match(new RegExp(`\\b${name}\\b`,'g'))||[]).length;
const rows=[];
for(const name of topNames){
  const consumers=runtimeFiles.map(file=>[file,refs(runtimeSources.get(file),name)]).filter(([,count])=>count>0);
  if(consumers.length)rows.push({name,consumers,total:consumers.reduce((sum,[,n])=>sum+n,0)});
}
rows.sort((a,b)=>a.consumers.length-b.consumers.length||a.total-b.total||a.name.localeCompare(b.name));
const singles=rows.filter(row=>row.consumers.length===1);
const multis=rows.filter(row=>row.consumers.length>1);

console.error('Batch 59 Residual Presentation Boundary RED inventory');
console.error(` - overlap total: ${rows.length}`);
console.error(` - single-runtime names: ${singles.length}`);
for(const row of singles)console.error(`   SINGLE ${row.name} :: ${row.consumers.map(([file,n])=>`${file}(${n})`).join(', ')}`);
console.error(` - multi-runtime names: ${multis.length}`);
for(const row of multis)console.error(`   MULTI ${row.name} :: ${row.consumers.map(([file,n])=>`${file}(${n})`).join(', ')}`);
console.error(' - scope filter: prefer pure read/presentation wrappers; reject actions, persistence, Restore/Cloud, Market Data, financial calculations and lexical DOM/id false positives.');
console.error(' - Batch 59 remains RED until one coherent low-risk boundary is selected and frozen by semantic gates.');
process.exit(1);
