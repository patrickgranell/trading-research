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
  const consumers=runtimeFiles.map(file=>[file,refs(runtimeSources.get(file),name)]).filter(([,n])=>n>0);
  if(consumers.length)rows.push({name,consumers,total:consumers.reduce((n,[,c])=>n+c,0)});
}
rows.sort((a,b)=>a.consumers.length-b.consumers.length||a.consumers[0]?.[0].localeCompare(b.consumers[0]?.[0]||'')||a.name.localeCompare(b.name));
console.log('Batch 62 fresh residual inventory');
console.log(` - raw app/runtime overlap names: ${rows.length}`);
console.log(` - single-runtime names: ${rows.filter(r=>r.consumers.length===1).length}`);
console.log(` - multi-runtime names: ${rows.filter(r=>r.consumers.length>1).length}`);
for(const file of runtimeFiles){
  const group=rows.filter(r=>r.consumers.length===1&&r.consumers[0][0]===file);
  if(!group.length)continue;
  console.log(`\n[${file}] single-runtime (${group.length})`);
  for(const r of group)console.log(` ${r.name} :: refs=${r.consumers[0][1]}`);
}
console.log('\n[multi-runtime]');
for(const r of rows.filter(r=>r.consumers.length>1))console.log(` ${r.name} :: ${r.consumers.map(([f,n])=>`${f}:${n}`).join(', ')}`);
console.error('\nBatch 62 RED expected: inventory only; no target family selected yet.');
process.exit(1);
