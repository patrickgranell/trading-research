import fs from 'node:fs';

const ID=/^[A-Za-z_$][\w$]*$/;
const HANDLER_ATTR=/\bdata-tr-on(?:click|change|input|submit)\s*=\s*(["'])([\s\S]*?)\1/g;
const ROOT_CALL=/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g;
export const TR_EXPLICIT_WINDOW_INVENTORY_SEMANTICS=Object.freeze({
  scope:'explicit-window-assignments',
  completeClassicScriptGlobalSurface:false,
  topLevelClassicDeclarationsIncluded:false,
  method:'quote-aware source scanner',
  note:'Counts explicit Object.assign(window, ...) and window/globalThis property assignments only.'
});

const BUILTIN_ROOTS=new Set([
  'if','for','while','switch','catch','function','return','typeof','void','delete','new',
  'Math','Number','String','Boolean','Array','Object','Date','JSON','RegExp','Set','Map','Promise',
  'parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent','alert','confirm','prompt',
  'setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','queueMicrotask'
]);

function skipQuoted(source,i,quote){
  i++;
  while(i<source.length){
    const c=source[i];
    if(c==='\\'){i+=2;continue;}
    if(c===quote)return i+1;
    i++;
  }
  throw new Error(`Unterminated ${quote} while scanning global surface.`);
}
function skipLineComment(source,i){const n=source.indexOf('\n',i+2);return n<0?source.length:n+1;}
function skipBlockComment(source,i){const n=source.indexOf('*/',i+2);if(n<0)throw new Error('Unterminated block comment while scanning global surface.');return n+2;}
function findMatching(source,open,openChar='{',closeChar='}'){
  let depth=1,i=open+1;
  while(i<source.length){
    const c=source[i],n=source[i+1];
    if(c==='"'||c==="'"||c==='`'){i=skipQuoted(source,i,c);continue;}
    if(c==='/'&&n==='/'){i=skipLineComment(source,i);continue;}
    if(c==='/'&&n==='*'){i=skipBlockComment(source,i);continue;}
    if(c===openChar)depth++;
    else if(c===closeChar&&--depth===0)return i;
    i++;
  }
  throw new Error(`Unbalanced ${openChar}${closeChar} while scanning global surface.`);
}
function splitTopLevel(source){
  const out=[];let start=0,i=0;const stack=[];
  while(i<source.length){
    const c=source[i],n=source[i+1];
    if(c==='"'||c==="'"||c==='`'){i=skipQuoted(source,i,c);continue;}
    if(c==='/'&&n==='/'){i=skipLineComment(source,i);continue;}
    if(c==='/'&&n==='*'){i=skipBlockComment(source,i);continue;}
    if(c==='('||c==='['||c==='{')stack.push(c);
    else if(c===')'||c===']'||c==='}')stack.pop();
    else if(c===','&&!stack.length){out.push(source.slice(start,i));start=i+1;}
    i++;
  }
  out.push(source.slice(start));return out;
}
function propertyName(segment){
  const s=segment.trim();if(!s||s.startsWith('...'))return null;
  if(ID.test(s))return s;
  const m=s.match(/^([A-Za-z_$][\w$]*)\s*:/);if(m)return m[1];
  const q=s.match(/^(['"])(.*?)\1\s*:/);return q?.[2]||null;
}

export function objectAssignWindowBlocks(source){
  const needle='Object.assign(window';const blocks=[];let from=0;
  while(true){
    const at=source.indexOf(needle,from);if(at<0)break;
    const comma=source.indexOf(',',at+needle.length);if(comma<0)throw new Error('Malformed Object.assign(window,...)');
    let open=comma+1;while(open<source.length&&/\s/.test(source[open]))open++;
    if(source[open]!=='{'){from=comma+1;continue;}
    const close=findMatching(source,open,'{','}');
    const props=splitTopLevel(source.slice(open+1,close)).map(propertyName).filter(Boolean);
    blocks.push({at,props});from=close+1;
  }
  return blocks;
}

export function handlerRootInventory(source){
  const roots=new Map(),handlers=[];
  for(const m of source.matchAll(HANDLER_ATTR)){
    const code=m[2];handlers.push(code);
    for(const c of code.matchAll(ROOT_CALL)){
      const name=c[1];if(BUILTIN_ROOTS.has(name))continue;
      roots.set(name,(roots.get(name)||0)+1);
    }
  }
  return {handlers:handlers.length,roots:Object.fromEntries([...roots].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))};
}

export function windowReadInventory(source){
  const reads=[];
  for(const m of source.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)/g)){
    const tail=source.slice(m.index+m[0].length);
    if(/^\s*=\s*(?!=)/.test(tail))continue;
    reads.push(m[1]);
  }
  return {count:reads.length,unique:[...new Set(reads)].sort()};
}

export function globalSurfaceInventory(source){
  const blocks=objectAssignWindowBlocks(source);
  const assignNames=blocks.flatMap(x=>x.props);
  const direct=[...source.matchAll(/\b(?:window|globalThis)\.([A-Za-z_$][\w$]*)\s*=\s*(?!=)/g)].map(m=>m[1]);
  const uniqueAssign=[...new Set(assignNames)].sort();
  const uniqueDirect=[...new Set(direct)].sort();
  const uniqueAll=[...new Set([...assignNames,...direct])].sort();
  const handlers=handlerRootInventory(source);
  const reads=windowReadInventory(source);
  const eventRoots=Object.keys(handlers.roots);
  const eventBacked=eventRoots.filter(x=>uniqueAll.includes(x));
  const exportedNotSeenInHandlers=uniqueAll.filter(x=>!eventRoots.includes(x));
  return {
    semantics:TR_EXPLICIT_WINDOW_INVENTORY_SEMANTICS,
    objectAssignBlocks:blocks.length,
    objectAssignEntries:assignNames.length,
    objectAssignUnique:uniqueAssign.length,
    directWindowAssignments:direct.length,
    directWindowUnique:uniqueDirect.length,
    explicitWindowUnique:uniqueAll.length,
    totalUniqueGlobals:uniqueAll.length, /* deprecated compatibility alias: NOT complete classic-script globals */
    windowReads:reads.count,
    windowReadUnique:reads.unique.length,
    handlerDeclarations:handlers.handlers,
    handlerRootCalls:eventRoots.length,
    handlerBackedGlobals:eventBacked.length,
    names:{objectAssign:uniqueAssign,direct:uniqueDirect,all:uniqueAll,windowReads:reads.unique,handlerRoots:eventRoots,eventBacked,eventUnmatched:eventRoots.filter(x=>!uniqueAll.includes(x)),exportedNotSeenInHandlers},
    handlerRootUsage:handlers.roots
  };
}

export function projectGlobalSurface(files){
  const perFile={},allText=[];
  for(const file of files){const text=fs.readFileSync(file,'utf8');allText.push(text);perFile[file]=globalSurfaceInventory(text);}
  const combined=globalSurfaceInventory(allText.join('\n'));
  return {files,perFile,combined};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const files=process.argv.slice(2);
  if(!files.length)throw new Error('Usage: node global-surface-inventory.mjs <file...>');
  const report=projectGlobalSurface(files),d=report.combined;
  console.log('Explicit window export inventory OK');
  console.log(` - Object.assign(window, ...) blocks: ${d.objectAssignBlocks}`);
  console.log(` - Object.assign exported entries: ${d.objectAssignEntries} (${d.objectAssignUnique} unique)`);
  console.log(` - Direct window/globalThis assignments: ${d.directWindowAssignments} (${d.directWindowUnique} unique)`);
  console.log(` - Total unique explicit window exports: ${d.explicitWindowUnique}`);
  console.log(' - Scope: explicit window/globalThis publications only; top-level classic declarations are intentionally out of scope');
  console.log(` - Declarative handlers scanned: ${d.handlerDeclarations}`);
  console.log(` - Handler root calls matching explicit globals: ${d.handlerBackedGlobals}/${d.handlerRootCalls}`);
  console.log(` - Top handler-backed globals: ${d.names.eventBacked.slice(0,30).join(', ')||'none'}`);
  console.log(` - Handler roots without explicit export: ${d.names.eventUnmatched.join(', ')||'none'}`);
  console.log(` - Explicit globals not called by declarative handlers: ${d.names.exportedNotSeenInHandlers.length}`);
  for(const file of files){
    const x=report.perFile[file];
    if(x.objectAssignBlocks||x.directWindowAssignments||x.windowReads)console.log(`   · ${file}: assign blocks ${x.objectAssignBlocks}, entries ${x.objectAssignEntries}/${x.objectAssignUnique} unique, direct ${x.directWindowAssignments}/${x.directWindowUnique} unique, window reads ${x.windowReads}/${x.windowReadUnique} unique`);
  }
  const appExports=new Set(report.perFile['app.js']?.names?.all||[]),runtimeReads=new Set();
  for(const file of files){if(file==='app.js')continue;for(const name of report.perFile[file]?.names?.windowReads||[])if(appExports.has(name))runtimeReads.add(name);}
  console.log(` - Cross-runtime window reads that depend on app exports: ${runtimeReads.size}`);
  console.log(` - Cross-runtime app globals read through window: ${[...runtimeReads].sort().join(', ')||'none'}`);
  console.log(` - First non-handler explicit globals: ${d.names.exportedNotSeenInHandlers.slice(0,80).join(', ')||'none'}`);
}
