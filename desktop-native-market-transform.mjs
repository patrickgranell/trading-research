/* Batch 78 · Desktop-only native Market Data routing.
 * Web sources remain unchanged; only desktop-dist embedded classic scripts are rewritten.
 */
import fs from 'node:fs';
const file='desktop-dist/index.html';
let html=fs.readFileSync(file,'utf8');

function script(tag){
  const start=html.indexOf('<script '+tag);
  if(start<0)throw new Error('Native Market Data transform missing '+tag);
  const open=html.indexOf('>',start)+1,end=html.indexOf('</script>',open);
  if(open<1||end<0)throw new Error('Native Market Data transform invalid boundary '+tag);
  return {open,end,text:html.slice(open,end)};
}
function replaceOnce(text,from,to,label){
  const i=text.indexOf(from);
  if(i<0||text.indexOf(from,i+from.length)!==-1)throw new Error('Native Market Data transform anchor drift '+label);
  return text.replace(from,to);
}

/* app.js / legacy V31.4 store surface */
{
  const p=script('data-tr-build=');
  let app=p.text;

  const put="async function v314StorePut(store,value){const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=()=>{const e=tx.error;db.close();reject(e);};});}";
  const putNative="async function v314StorePut(store,value){if(globalThis.TradingResearchDesktopMarketAuthority?.migrationPending)throw new Error('Migración nativa de Market Data en curso.');if(globalThis.TradingResearchDesktopMarketAuthority?.active)return globalThis.TradingResearchDesktopMarketBridge.put(store,value);const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>{db.close();resolve(value);};tx.onerror=()=>{const e=tx.error;db.close();reject(e);};});}";
  app=replaceOnce(app,put,putNative,'v314StorePut');

  const get="async function v314StoreGet(store,id){const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).get(id);req.onsuccess=()=>{db.close();resolve(req.result||null);};req.onerror=()=>{const e=req.error;db.close();reject(e);};});}";
  const getNative="async function v314StoreGet(store,id){if(globalThis.TradingResearchDesktopMarketAuthority?.active)return globalThis.TradingResearchDesktopMarketBridge.get(store,id);const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).get(id);req.onsuccess=()=>{db.close();resolve(req.result||null);};req.onerror=()=>{const e=req.error;db.close();reject(e);};});}";
  app=replaceOnce(app,get,getNative,'v314StoreGet');

  const all="async function v314StoreAll(store){const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).getAll();req.onsuccess=()=>{db.close();resolve(req.result||[]);};req.onerror=()=>{const e=req.error;db.close();reject(e);};});}";
  const allNative="async function v314StoreAll(store){if(globalThis.TradingResearchDesktopMarketAuthority?.active)return globalThis.TradingResearchDesktopMarketBridge.all(store);const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),req=tx.objectStore(store).getAll();req.onsuccess=()=>{db.close();resolve(req.result||[]);};req.onerror=()=>{const e=req.error;db.close();reject(e);};});}";
  app=replaceOnce(app,all,allNative,'v314StoreAll');

  const del="async function v314StoreDelete(store,id){const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{const e=tx.error;db.close();reject(e);};});}";
  const delNative="async function v314StoreDelete(store,id){if(globalThis.TradingResearchDesktopMarketAuthority?.migrationPending)throw new Error('Migración nativa de Market Data en curso.');if(globalThis.TradingResearchDesktopMarketAuthority?.active)return globalThis.TradingResearchDesktopMarketBridge.del(store,id);const db=await v314Db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).delete(id);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{const e=tx.error;db.close();reject(e);};});}";
  app=replaceOnce(app,del,delNative,'v314StoreDelete');

  const deleteMarket="async function v314DeleteMarket(id){if(!confirm('¿Eliminar este histórico local? No afecta al Trading Plan ni a Supabase.'))return;await v314StoreDelete('marketMeta',id);await v314StoreDelete('marketTicks',id);v314TickCacheDelete(id);if(v314MarketUi.activeMarketId===id)v314MarketUi.activeMarketId='';await v314RefreshMarketDataState();}";
  const deleteMarketNative="async function v314DeleteMarket(id){if(!confirm('¿Eliminar este histórico local? No afecta al Trading Plan ni a Supabase.'))return;if(globalThis.TradingResearchDesktopMarketAuthority?.active)await globalThis.TradingResearchDesktopMarketBridge.deleteDataset(id);else{await v314StoreDelete('marketMeta',id);await v314StoreDelete('marketTicks',id);}v314TickCacheDelete(id);if(v314MarketUi.activeMarketId===id)v314MarketUi.activeMarketId='';await v314RefreshMarketDataState();}";
  app=replaceOnce(app,deleteMarket,deleteMarketNative,'v314DeleteMarket');

  html=html.slice(0,p.open)+app+html.slice(p.end);
}

/* state-runtime: preserve grouped external transaction semantics on Desktop native authority. */
{
  const p=script('data-tr-state-runtime=');
  let state=p.text;
  const old="async function trV314ApplyChanges(changes){\n  const list=[...changes];if(!list.length)return 0;if(typeof v314Db!=='function')throw new Error('Market Data IndexedDB no está disponible.');";
  const neu="async function trV314ApplyChanges(changes){\n  const list=[...changes];if(!list.length)return 0;\n  if(globalThis.TradingResearchDesktopMarketAuthority?.migrationPending)throw new Error('Migración nativa de Market Data en curso.');\n  if(globalThis.TradingResearchDesktopMarketAuthority?.active){await globalThis.TradingResearchDesktopMarketBridge.applyChanges(list,'state-runtime.market-batch');return list.length;}\n  if(typeof v314Db!=='function')throw new Error('Market Data IndexedDB no está disponible.');";
  state=replaceOnce(state,old,neu,'trV314ApplyChanges');
  html=html.slice(0,p.open)+state+html.slice(p.end);
}

/* Backup V2 reads through patched v314StoreAll; full replacement must not touch stale IDB. */
{
  const p=script('data-tr-backup-v2-runtime=');
  let backup=p.text;
  const old="async function trBackupV2ReplaceMarketData(marketData){\n  if(typeof v314Db!=='function')throw new Error('Market Data IndexedDB no está disponible.');";
  const neu="async function trBackupV2ReplaceMarketData(marketData){\n  if(globalThis.TradingResearchDesktopMarketAuthority?.migrationPending)throw new Error('Migración nativa de Market Data en curso.');\n  if(globalThis.TradingResearchDesktopMarketAuthority?.active)return await globalThis.TradingResearchDesktopMarketBridge.replaceAll(marketData);\n  if(typeof v314Db!=='function')throw new Error('Market Data IndexedDB no está disponible.');";
  backup=replaceOnce(backup,old,neu,'trBackupV2ReplaceMarketData');
  html=html.slice(0,p.open)+backup+html.slice(p.end);
}

html=html.replace('</head>',()=>'<meta name="trading-research-desktop-native-marketdata" content="batch78" />\n</head>');
fs.writeFileSync(file,html);
console.log('Batch 78 Desktop artifact routes Market Data IO/import/BackupV2 to native authority only when promoted; Web unchanged.');
