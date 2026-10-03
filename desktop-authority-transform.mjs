/* Batch 76 · Transform generated Desktop artifact only; never mutate Web files. */
import fs from 'node:fs';
const file='desktop-dist/index.html';
let html=fs.readFileSync(file,'utf8');
const start=html.indexOf('<script data-tr-build=');
if(start<0)throw new Error('Desktop app build script missing.');
const open=html.indexOf('>',start)+1,end=html.indexOf('</script>',open);
if(open<1||end<0)throw new Error('Desktop app script boundary missing.');
let app=html.slice(open,end);
function once(from,to){
  const i=app.indexOf(from);
  if(i<0||app.indexOf(from,i+from.length)!==-1)throw new Error('Desktop authority transform anchor drift: '+from.slice(0,85));
  app=app.replace(from,to);
}
const bridge=fs.readFileSync('desktop-authority-bridge.js','utf8');
once('async function trCoreBootstrap(){','async function trCoreBootstrapIndexedDb(){');
once("  document.documentElement.classList.remove('tr-core-loading');\n  if(trCoreFatal){",
     "  if(globalThis.TradingResearchDesktopAuthority?.migrationPending)return;\n  document.documentElement.classList.remove('tr-core-loading');\n  if(trCoreFatal){");
once("async function trCorePersistNow(reason='persist'){\n",
     "async function trCorePersistNow(reason='persist'){\n  if(trDesktopAuthorityControl.active)return await trDesktopAuthorityQueueStateWrite(reason);\n");
once("function trCoreQueueStateWrite(reason='persist'){\n",
     "function trCoreQueueStateWrite(reason='persist'){\n  if(trDesktopAuthorityControl.active)return trDesktopAuthorityQueueStateWrite(reason);\n");
once('/* ===== END V31.11 CORE ===== */',bridge+'\n/* ===== END V31.11 CORE ===== */');
html=html.slice(0,open)+app.replace(/<\/script/gi,'<\\/script')+html.slice(end);
html=html.replace('</head>',()=>'<meta name="trading-research-desktop-authority" content="0.4.0" />\n</head>');
fs.writeFileSync(file,html);
console.log('Prepared isolated Desktop 0.4.0 SQLite authority bridge; Web source unaffected.');
