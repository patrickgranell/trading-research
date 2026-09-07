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
console.error('Batch 60 residual read/presentation inventory (RED expected)');
console.error(` - overlap total: ${rows.length}`);
console.error(` - single-runtime names: ${rows.filter(x=>x.consumers.length===1).length}`);
console.error(` - multi-runtime names: ${rows.filter(x=>x.consumers.length>1).length}`);
for(const row of rows){
  console.error(` - ${row.name} | runtimes=${row.consumers.length} refs=${row.total} | ${row.consumers.map(([file,count])=>`${file}(${count})`).join(', ')}`);
}
console.error('Batch 60 inventory intentionally RED: select only a genuinely read/presentation boundary after reviewing the residual consumers.');
process.exit(1);
