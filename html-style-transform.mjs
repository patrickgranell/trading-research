/*
 * Zero-dependency legacy HTML attribute scanner.
 *
 * Trading Research still contains HTML fragments inside JavaScript strings/template
 * literals, so a DOM parser over index.html alone cannot see the attributes that are
 * generated at runtime. The former build step used a global regex over entire source
 * files. This scanner instead rewrites only a `style` token that is lexically inside
 * an unclosed, syntactically plausible HTML opening tag.
 */
function trIsSpace(c){return c===' '||c==='\t'||c==='\n'||c==='\r'||c==='\f';}
function trIsTagNameStart(c){return !!c&&/[A-Za-z]/.test(c);}
function trIsTagNameChar(c){return !!c&&/[A-Za-z0-9:-]/.test(c);}
function trIsAttrBoundary(c){return c===undefined||trIsSpace(c)||c==='/'||c==='>'||c==='`';}

function trPlausibleTagStart(src,i){
  let p=i+1;while(trIsSpace(src[p]))p++;
  if(src[p]==='/'||src[p]==='!'||src[p]==='?')return false;
  if(!trIsTagNameStart(src[p]))return false;
  p++;while(trIsTagNameChar(src[p]))p++;
  return trIsAttrBoundary(src[p]);
}
function trTagOpenThrough(src,start,end){
  let quote='';
  for(let p=start+1;p<end;p++){
    const c=src[p];
    if(quote){if(c===quote&&src[p-1]!=='\\')quote='';continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='>')return false;
  }
  return true;
}
function trOpenTagStartBefore(src,at){
  /* Search backwards for a plausible `<tag ...` and validate its span forward.
     A `>` inside a quoted attribute value does not close the tag. */
  for(let i=at-1;i>=0;i--){
    if(src[i]!=='<')continue;
    if(!trPlausibleTagStart(src,i))continue;
    if(trTagOpenThrough(src,i,at))return i;
  }
  return -1;
}
function trStyleAttributeToken(src,at){
  if(src.slice(at,at+5).toLowerCase()!=='style')return null;
  const before=src[at-1];if(before!==undefined&&!trIsSpace(before))return null;
  const afterName=src[at+5];if(afterName!==undefined&&!trIsSpace(afterName)&&afterName!=='=')return null;
  let p=at+5;while(trIsSpace(src[p]))p++;
  if(src[p]!=='=')return null;p++;while(trIsSpace(src[p]))p++;
  if(src[p]!=="'"&&src[p]!=='"')return null;
  return {end:at+5};
}

export function transformStyleAttrs(input){
  const src=String(input??'');let out='',last=0,converted=0;
  for(let i=0;i<src.length-4;i++){
    const c=src[i];if(c!=='s'&&c!=='S')continue;
    const token=trStyleAttributeToken(src,i);if(!token)continue;
    if(trOpenTagStartBefore(src,i)<0)continue;
    out+=src.slice(last,i)+'data-tr-style';last=token.end;converted++;i=token.end-1;
  }
  return {source:out+src.slice(last),converted};
}

export function styleTransformSelfTest(){
  const fixtures=[
    {input:'<div style="color:red">x</div>',converted:1,contains:'data-tr-style="color:red"'},
    {input:'<div class="x"\n style = \'margin:0\'>x</div>',converted:1,contains:"data-tr-style = 'margin:0'"},
    {input:'<button data-tr-onclick="x>y" style="width:10px">',converted:1,contains:'data-tr-style="width:10px"'},
    {input:'const style="color:red";',converted:0,contains:'const style="color:red";'},
    {input:'Documentation says style="color:red" without a tag.',converted:0,contains:'style="color:red"'},
    {input:'x > style="color:red"',converted:0,contains:'style="color:red"'},
    {input:'<div data-style="x">',converted:0,contains:'data-style="x"'}
  ];
  const failures=[];
  for(const f of fixtures){const got=transformStyleAttrs(f.input);if(got.converted!==f.converted||!got.source.includes(f.contains))failures.push({fixture:f,got});}
  return {ok:failures.length===0,failures};
}
