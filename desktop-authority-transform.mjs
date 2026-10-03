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
once("if(trCoreMode!=='indexeddb')return trCoreSafeLocalSet('tradingResearchCloudSnapshotHistory_v2'",
     "if(trCoreMode!=='indexeddb'&&trCoreMode!=='sqlite-authority')return trCoreSafeLocalSet('tradingResearchCloudSnapshotHistory_v2'");
once("ok=i.mode==='indexeddb',mode=ok?'IndexedDB · durable'",
     "ok=i.mode==='sqlite-authority',mode=ok?'SQLite · autoridad'");
once("trCoreMode==='indexeddb'?'IndexedDB.':'el fallback local.'",
     "trCoreMode==='sqlite-authority'?'SQLite.':trCoreMode==='indexeddb'?'IndexedDB.':'el fallback local.'");
once('/* ===== END V31.11 CORE ===== */',bridge+'\n/* ===== END V31.11 CORE ===== */');
html=html.slice(0,open)+app.replace(/<\/script/gi,'<\\/script')+html.slice(end);
/* Fail-closed exclusive operations only in Desktop's generated state runtime. */
const stateStart=html.indexOf('<script data-tr-state-runtime=');
if(stateStart<0)throw new Error('Desktop state runtime script missing.');
const stateOpen=html.indexOf('>',stateStart)+1,stateEnd=html.indexOf('</script>',stateOpen);
if(stateOpen<1||stateEnd<0)throw new Error('Desktop state runtime boundary missing.');
let stateScript=html.slice(stateOpen,stateEnd);
const unsafe="if(typeof trCoreFlush==='function')await trCoreFlush();return await task();";
if(!stateScript.includes(unsafe))throw new Error('Desktop exclusive flush safety anchor drift.');
stateScript=stateScript.replace(unsafe,"if(typeof trCoreFlush==='function'&&!(await trCoreFlush()))throw new Error('Desktop SQLite: exclusive abortada; flush no confirmado.');return await task();");
html=html.slice(0,stateOpen)+stateScript+html.slice(stateEnd);

html=html.replace('</head>',()=>'<meta name="trading-research-desktop-authority" content="0.4.0" />\n</head>');
fs.writeFileSync(file,html);
console.log('Prepared isolated Desktop 0.4.0 SQLite authority bridge; Web source unaffected.');
