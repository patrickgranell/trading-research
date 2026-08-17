import fs from 'node:fs';
import crypto from 'node:crypto';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const v=pkg.version;
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
let h=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const safeScript=s=>s.replace(/<\/script/gi,'<\\/script');
const replacements=[
  ['app.js','data-tr-build',safeScript(fs.readFileSync('app.js','utf8'))],
  ['structural-runtime.js','data-tr-structural-runtime',safeScript(fs.readFileSync('structural-runtime.js','utf8'))],
  ['state-runtime.js','data-tr-state-runtime',safeScript(fs.readFileSync('state-runtime.js','utf8'))],
  ['security-runtime.js','data-tr-security-runtime',safeScript(fs.readFileSync('security-runtime.js','utf8'))],
  ['event-runtime.js','data-tr-event-runtime',safeScript(fs.readFileSync('event-runtime.js','utf8'))],
  ['csp-runtime.js','data-tr-csp-runtime',safeScript(fs.readFileSync('csp-runtime.js','utf8'))],
  ['style-runtime.js','data-tr-style-runtime',safeScript(fs.readFileSync('style-runtime.js','utf8'))],
];
const sha256=s=>`'sha256-${crypto.createHash('sha256').update(s,'utf8').digest('base64')}'`;
const styleSourceFiles=['app.js','structural-runtime.js','state-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','index.html'];
const styleSourceText=styleSourceFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
const styleInlineAttributes=[...styleSourceText.matchAll(/\bstyle\s*=\s*["']/gi)].length;
const styleCssomWrites=[...styleSourceText.matchAll(/\.style\.[A-Za-z_$][\w$]*\s*=/g)].length+[...styleSourceText.matchAll(/setAttribute\s*\(\s*["']style["']/gi)].length;
const styleProperties={};
for(const file of styleSourceFiles){
  const src=fs.readFileSync(file,'utf8');
  for(const m of src.matchAll(/\bstyle\s*=\s*(["'])(.*?)\1/gis)){
    for(const prop of m[2].matchAll(/(?:^|;)\s*([a-zA-Z-]+)\s*:/g))styleProperties[prop[1]]=(styleProperties[prop[1]]||0)+1;
  }
  for(const m of src.matchAll(/\.style\.([A-Za-z_$][\w$]*)\s*=/g))styleProperties[m[1]]=(styleProperties[m[1]]||0)+1;
}

// IMPORTANT: use replacer callbacks. Passing source code as a replacement string makes
// String.replace interpret $`, $' and $& inside JavaScript as replacement tokens,
// which can splice/duplicate the whole HTML document and corrupt the deployed bundle.
h=h.replace(/<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']\s*\/?\s*>/i,()=>`<style data-tr-build="${v}">${css}</style>`);
for(const [file,attr,src] of replacements){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`<script\\s+src=["']${escaped}["']\\s*><\\/script>`,'i');
  h=h.replace(re,()=>`<script ${attr}="${v}">${src}</script>`);
}
h=h.replace('</head>',()=>`  <meta name="trading-research-build-version" content="${v}" />\n  <meta name="trading-research-csp-version" content="${v}" />\n  <meta name="trading-research-style-source-inline-attrs" content="${styleInlineAttributes}" />\n  <meta name="trading-research-style-source-cssom-writes" content="${styleCssomWrites}" />\n</head>`);
fs.writeFileSync('dist/index.html',h);

const scriptHashes=replacements.map(([, ,src])=>sha256(src));
const styleHash=sha256(css);
const supabasePath='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/';
const csp=[
  "default-src 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'none'",
  `script-src-elem ${scriptHashes.join(' ')} ${supabasePath}`,
  "script-src-attr 'none'",
  "style-src 'none'",
  `style-src-elem ${styleHash}`,
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self'",
  "media-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "manifest-src 'self'",
  "upgrade-insecure-requests"
].join('; ')+ ';';
const headers=`/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()\n`;
fs.writeFileSync('dist/_headers',headers);
fs.writeFileSync('dist/csp-manifest.json',JSON.stringify({version:v,scriptHashes,styleHash,supabasePath,csp},null,2)+'\n');
fs.writeFileSync('dist/style-inventory.json',JSON.stringify({version:v,sourceFiles:styleSourceFiles,inlineAttributes:styleInlineAttributes,cssomWrites:styleCssomWrites,totalSourceDebt:styleInlineAttributes+styleCssomWrites,properties:Object.fromEntries(Object.entries(styleProperties).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))},null,2)+'\n');
console.log(`Built Trading Research ${v} -> dist/index.html`);
console.log(`Generated CSP -> dist/_headers (${scriptHashes.length} script hashes + 1 style hash)`);
console.log(`Style inventory -> ${styleInlineAttributes} inline attrs + ${styleCssomWrites} CSSOM writes`);
