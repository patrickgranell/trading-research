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
  if(consumers.length)rows.push({name,consumers,total:consumers.reduce((n,[,count])=>n+count,0)});
}
rows.sort((a,b)=>a.consumers.length-b.consumers.length||a.total-b.total||a.name.localeCompare(b.name));
const stateOnly=rows.filter(r=>r.consumers.length===1&&r.consumers[0][0]==='state-runtime.js');
const reportsOnly=rows.filter(r=>r.consumers.length===1&&r.consumers[0][0]==='reports-purity-runtime.js');
const editing=stateOnly.filter(r=>/^editing|^cloning/.test(r.name));
console.error('Batch 61 homogeneous residual inventory (RED expected)');
console.error(` - overlap total: ${rows.length}`);
console.error(` - single-runtime names: ${rows.filter(x=>x.consumers.length===1).length}`);
console.error(` - state-only names: ${stateOnly.length}`);
console.error(` - reports-only names: ${reportsOnly.length}`);
console.error(` - editing/cloning state candidates: ${editing.length}`);
for(const r of editing)console.error(`   COMMAND_INTENT ${r.name} refs=${r.total}`);
console.error(' - all state-only candidates:');
for(const r of stateOnly)console.error(`   STATE ${r.name} refs=${r.total}`);
console.error(' - all reports-only candidates:');
for(const r of reportsOnly)console.error(`   REPORT ${r.name} refs=${r.total}`);
console.error('Batch 61 intentionally RED: choose a homogeneous multi-symbol boundary only after reviewing the complete safe-candidate set.');
process.exit(1);
