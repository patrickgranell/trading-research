import fs from 'node:fs';
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
];
// IMPORTANT: use replacer callbacks. Passing source code as a replacement string makes
// String.replace interpret $`, $' and $& inside JavaScript as replacement tokens,
// which can splice/duplicate the whole HTML document and corrupt the deployed bundle.
h=h.replace(/<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']\s*\/?\s*>/i,()=>`<style data-tr-build="${v}">${css}</style>`);
for(const [file,attr,src] of replacements){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`<script\\s+src=["']${escaped}["']\\s*><\\/script>`,'i');
  h=h.replace(re,()=>`<script ${attr}="${v}">${src}</script>`);
}
h=h.replace('</head>',()=>`  <meta name="trading-research-build-version" content="${v}" />\n</head>`);
fs.writeFileSync('dist/index.html',h);
console.log(`Built Trading Research ${v} -> dist/index.html`);
