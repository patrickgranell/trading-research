const RENDER_ASSIGNMENT=/\brender\s*=\s*function\s*\(\s*\)\s*\{/g;
const TOP_LEVEL_RENDER_CALL=/^render\(\);\s*$/gm;
const DEAD_RENDER_BASE_ALIAS=/^const renderV(?:21|30|312|313|314)Base=render;\s*$/gm;

function skipQuoted(source,i,quote){
  i++;
  while(i<source.length){
    const c=source[i];
    if(c==='\\'){i+=2;continue;}
    if(c===quote)return i+1;
    i++;
  }
  throw new Error(`Unterminated ${quote} string while scanning legacy render assignment.`);
}

function skipLineComment(source,i){
  const n=source.indexOf('\n',i+2);return n<0?source.length:n+1;
}

function skipBlockComment(source,i){
  const n=source.indexOf('*/',i+2);if(n<0)throw new Error('Unterminated block comment while scanning legacy render assignment.');return n+2;
}

function findFunctionEnd(source,openBrace){
  let depth=1,i=openBrace+1;
  while(i<source.length){
    const c=source[i],n=source[i+1];
    if(c==='"'||c==="'"||c==='`'){i=skipQuoted(source,i,c);continue;}
    if(c==='/'&&n==='/'){i=skipLineComment(source,i);continue;}
    if(c==='/'&&n==='*'){i=skipBlockComment(source,i);continue;}
    if(c==='{')depth++;
    else if(c==='}'&&--depth===0){
      i++;
      while(i<source.length&&/\s/.test(source[i]))i++;
      if(source[i]===';')i++;
      return i;
    }
    i++;
  }
  throw new Error('Unbalanced legacy render assignment.');
}

function removeRanges(source,ranges,marker){
  let out=source;
  for(const [start,end] of [...ranges].sort((a,b)=>b[0]-a[0]))out=out.slice(0,start)+marker+out.slice(end);
  return out;
}

function pruneTopLevelRenderCalls(source,{expected=5,keep=1}={}){
  const matches=[...source.matchAll(TOP_LEVEL_RENDER_CALL)];
  if(matches.length!==expected)throw new Error(`Top-level render() inventory changed: expected ${expected}, found ${matches.length}.`);
  const remove=matches.slice(keep).map(m=>[m.index,m.index+m[0].length]);
  return {source:removeRanges(source,remove,'/* V31.23.3: redundant bootstrap render() removed */'),removed:remove.length,kept:Math.min(keep,matches.length)};
}

function pruneDeadRenderAliases(source,{expected=5}={}){
  const matches=[...source.matchAll(DEAD_RENDER_BASE_ALIAS)];
  if(matches.length!==expected)throw new Error(`Legacy render base alias inventory changed: expected ${expected}, found ${matches.length}.`);
  const ranges=matches.map(m=>[m.index,m.index+m[0].length]);
  return {source:removeRanges(source,ranges,'/* V31.23.3: dead render base alias removed */'),removed:ranges.length};
}

export function consolidateLegacyRenderAssignments(source,{expected=12}={}){
  const matches=[...source.matchAll(RENDER_ASSIGNMENT)];
  if(matches.length!==expected)throw new Error(`Legacy render assignment inventory changed: expected ${expected}, found ${matches.length}.`);
  const ranges=matches.map(m=>{
    const start=m.index;
    const openBrace=start+m[0].lastIndexOf('{');
    return [start,findFunctionEnd(source,openBrace)];
  });
  let out=removeRanges(source,ranges,'/* V31.23.2: legacy render assignment removed from bundled source */');
  const remaining=(out.match(RENDER_ASSIGNMENT)||[]).length;
  if(remaining!==0)throw new Error(`Legacy render consolidation incomplete: ${remaining} assignment(s) remain.`);
  const calls=pruneTopLevelRenderCalls(out,{expected:5,keep:1});out=calls.source;
  const aliases=pruneDeadRenderAliases(out,{expected:5});out=aliases.source;
  return {source:out,removed:ranges.length,bootstrapCallsRemoved:calls.removed,bootstrapCallsKept:calls.kept,renderAliasesRemoved:aliases.removed};
}

export function renderDebtInventory(source){
  return {
    assignments:(source.match(RENDER_ASSIGNMENT)||[]).length,
    declarations:(source.match(/\bfunction\s+render\s*\(/g)||[]).length,
    topLevelCalls:(source.match(TOP_LEVEL_RENDER_CALL)||[]).length,
    baseAliases:(source.match(DEAD_RENDER_BASE_ALIAS)||[]).length,
    destructiveRootWrites:(source.match(/document\.getElementById\(['"]app['"]\)\.innerHTML\s*=\s*shell\(\)/g)||[]).length
  };
}
