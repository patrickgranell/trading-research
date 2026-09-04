import fs from 'node:fs';

const app=fs.readFileSync('app.js','utf8');
const runtimeFiles=[
  'style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js',
  'persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js',
  'cloud-v10-runtime.js','exit-lab-runtime.js','canonical-metrics-runtime.js','csp-runtime.js',
  'style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'
];

const fnNames=[...app.matchAll(/(?:^|\n)function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]);
const varNames=[...app.matchAll(/(?:^|\n)(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)].map(m=>m[1]);
const topNames=[...new Set([...fnNames,...varNames])];

function maskNonCode(src){
  const out=[...src];
  let i=0,state='code',quote='',templateDepth=0;
  const blank=j=>{if(out[j]!=='\n'&&out[j]!=='\r')out[j]=' ';};
  while(i<src.length){
    const c=src[i],n=src[i+1];
    if(state==='code'){
      if(c==='/'&&n==='/'){blank(i);blank(i+1);i+=2;state='line';continue;}
      if(c==='/'&&n==='*'){blank(i);blank(i+1);i+=2;state='block';continue;}
      if(c==='"'||c==="'"){quote=c;blank(i);i++;state='string';continue;}
      if(c==='`'){blank(i);i++;state='template';templateDepth=0;continue;}
      i++;continue;
    }
    if(state==='line'){
      if(c==='\n'){state='code';i++;}else{blank(i);i++;}continue;
    }
    if(state==='block'){
      if(c==='*'&&n==='/'){blank(i);blank(i+1);i+=2;state='code';}else{blank(i);i++;}continue;
    }
    if(state==='string'){
      if(c==='\\'){blank(i);if(i+1<src.length)blank(i+1);i+=2;continue;}
      blank(i);i++;if(c===quote)state='code';continue;
    }
    if(state==='template'){
      if(c==='\\'){blank(i);if(i+1<src.length)blank(i+1);i+=2;continue;}
      if(c==='`'&&templateDepth===0){blank(i);i++;state='code';continue;}
      // For ranking, mask template text and interpolation alike; false negatives are safer than string-token false positives.
      blank(i);i++;continue;
    }
  }
  return out.join('');
}

const riskPattern=/(cloud|supabase|persist|storage|backup|restore|security|csp|market|metric|calc|risk|delete|remove|save|import|blob|image|store|state|domain|operation|trade|position|ledger|taxonomy|integrity|sync|write|flush|rpc|upload|download|exit|mfe|mae)/i;
const runtimePenalty={
  'structural-runtime.js':0,
  'reports-purity-runtime.js':1,
  'render-closure-runtime.js':1,
  'style-runtime.js':1,
  'style-attr-runtime.js':1,
  'state-runtime.js':5,
  'event-runtime.js':5,
  'canonical-metrics-runtime.js':7,
  'exit-lab-runtime.js':7,
  'blob-lifecycle-runtime.js':9,
  'operation-cleanup-runtime.js':9,
  'backup-v2-runtime.js':9,
  'persistence-coalescing-runtime.js':10,
  'cloud-v10-runtime.js':10,
  'security-runtime.js':10,
  'csp-runtime.js':10
};

const rows=[];
for(const name of topNames){
  const re=new RegExp(`\\b${name.replace(/[$]/g,'\\$&')}\\b`,'g');
  const refs=[];let totalRaw=0,totalCode=0;
  for(const file of runtimeFiles){
    const src=fs.readFileSync(file,'utf8'),masked=maskNonCode(src);
    const raw=[...src.matchAll(re)].length,code=[...masked.matchAll(re)].length;
    if(raw){
      totalRaw+=raw;totalCode+=code;
      const idx=masked.search(re)>=0?masked.search(re):src.search(re);
      const line=idx<0?0:src.slice(0,idx).split('\n').length;
      const text=line?src.split('\n')[line-1].trim().slice(0,180):'';
      refs.push({file,raw,code,line,text});
    }
  }
  if(!totalRaw)continue;
  const executable=refs.filter(x=>x.code>0);
  const score=(riskPattern.test(name)?20:0)+Math.min(...refs.map(x=>runtimePenalty[x.file]??6))+(executable.length===0?50:0)+(refs.length>1?2:0);
  rows.push({name,totalRaw,totalCode,refs,score});
}

rows.sort((a,b)=>a.score-b.score||a.totalCode-b.totalCode||a.refs.length-b.refs.length||a.name.localeCompare(b.name));
console.log(`OVERLAP TOTAL ${rows.length}`);
console.log(`EXECUTABLE CANDIDATES ${rows.filter(x=>x.totalCode>0).length}`);
console.log('TOP LOW-RISK EXECUTABLE CANDIDATES');
for(const row of rows.filter(x=>x.totalCode>0).slice(0,80)){
  console.log(`CANDIDATE ${row.name} | score=${row.score} raw=${row.totalRaw} code=${row.totalCode}`);
  for(const r of row.refs)console.log(`  ${r.file}:${r.line} raw=${r.raw} code=${r.code} :: ${r.text}`);
}
console.log('STRING/COMMENT-ONLY OVERLAPS');
for(const row of rows.filter(x=>x.totalCode===0))console.log(`NONCODE ${row.name} raw=${row.totalRaw} :: ${row.refs.map(r=>r.file).join(',')}`);
console.error('Diagnostic ranking intentionally exits non-zero.');
process.exit(1);
