const RENDER_ASSIGNMENT=/\brender\s*=\s*function\s*\(\s*\)\s*\{/g;

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

export function consolidateLegacyRenderAssignments(source,{expected=12}={}){
  const matches=[...source.matchAll(RENDER_ASSIGNMENT)];
  if(matches.length!==expected)throw new Error(`Legacy render assignment inventory changed: expected ${expected}, found ${matches.length}.`);
  const ranges=matches.map(m=>{
    const start=m.index;
    const openBrace=start+m[0].lastIndexOf('{');
    return [start,findFunctionEnd(source,openBrace)];
  });
  let out=source;
  for(const [start,end] of ranges.reverse())out=out.slice(0,start)+`/* V31.23.2: legacy render assignment removed from bundled source */`+out.slice(end);
  const remaining=(out.match(RENDER_ASSIGNMENT)||[]).length;
  if(remaining!==0)throw new Error(`Legacy render consolidation incomplete: ${remaining} assignment(s) remain.`);
  return {source:out,removed:ranges.length};
}

export function renderDebtInventory(source){
  return {
    assignments:(source.match(RENDER_ASSIGNMENT)||[]).length,
    declarations:(source.match(/\bfunction\s+render\s*\(/g)||[]).length,
    destructiveRootWrites:(source.match(/document\.getElementById\(['"]app['"]\)\.innerHTML\s*=\s*shell\(\)/g)||[]).length
  };
}
