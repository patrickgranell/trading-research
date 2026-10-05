/* Batch 77 · Desktop-only native image authority transform.
 * Web source files remain byte-identical; only desktop-dist is rewritten.
 */
import fs from 'node:fs';
const file='desktop-dist/index.html';
let html=fs.readFileSync(file,'utf8');
function script(tag){
  const start=html.indexOf('<script '+tag);
  if(start<0)throw new Error('Native image transform missing '+tag);
  const open=html.indexOf('>',start)+1,end=html.indexOf('</script>',open);
  if(open<1||end<0)throw new Error('Native image transform invalid boundary '+tag);
  return {open,end,text:html.slice(open,end)};
}
function replaceOnce(text,from,to,label){
  const i=text.indexOf(from);
  if(i<0||text.indexOf(from,i+from.length)!==-1)throw new Error('Native image transform anchor drift '+label);
  return text.replace(from,to);
}
{
  const p=script('data-tr-build=');
  let app=p.text;
  const store="async function storeImageFile(file,id){const db=await imageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).put({id,blob:file,name:file.name,type:file.type,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}";
  app=replaceOnce(app,store,"async function storeImageFile(file,id){if(globalThis.TradingResearchDesktopImageAuthority?.migrationPending)throw new Error('Migración nativa de imágenes en curso.');if(globalThis.TradingResearchDesktopImageAuthority?.active)return trDesktopImageWriteFile(file,id);const db=await imageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).put({id,blob:file,name:file.name,type:file.type,updatedAt:new Date().toISOString()});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}",'storeImageFile');
  const get="async function getImageBlob(id){try{const db=await imageDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readonly'),r=tx.objectStore(IMAGE_STORE).get(id);r.onsuccess=()=>resolve(r.result?.blob||null);r.onerror=()=>reject(r.error);});}catch{return null;}}";
  app=replaceOnce(app,get,"async function getImageBlob(id){if(globalThis.TradingResearchDesktopImageAuthority?.active)return await trDesktopImageReadBlob(id);try{const db=await imageDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readonly'),r=tx.objectStore(IMAGE_STORE).get(id);r.onsuccess=()=>resolve(r.result?.blob||null);r.onerror=()=>reject(r.error);});}catch{return null;}}",'getImageBlob');
  const del="async function deleteImageBlob(id){try{const db=await imageDb();await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{}}";
  app=replaceOnce(app,del,"async function deleteImageBlob(id){if(globalThis.TradingResearchDesktopImageAuthority?.migrationPending)throw new Error('Migración nativa de imágenes en curso.');if(globalThis.TradingResearchDesktopImageAuthority?.active)return await trDesktopImageDeleteIds([id],'image.delete.compat');try{const db=await imageDb();await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{}}",'deleteImageBlob');
  const all="async function getAllImageRecords(){\n  try{const db=await imageDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readonly'),req=tx.objectStore(IMAGE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}catch{return [];}\n}";
  app=replaceOnce(app,all,"async function getAllImageRecords(){\n  if(globalThis.TradingResearchDesktopImageAuthority?.active)return await trDesktopImageListRecords();\n  try{const db=await imageDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readonly'),req=tx.objectStore(IMAGE_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}catch{return [];}\n}",'getAllImageRecords');
  const clear="async function clearImageStore(){\n  const db=await imageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});\n}";
  app=replaceOnce(app,clear,"async function clearImageStore(){\n  if(globalThis.TradingResearchDesktopImageAuthority?.migrationPending)throw new Error('Migración nativa de imágenes en curso.');\n  if(globalThis.TradingResearchDesktopImageAuthority?.active)return await trDesktopImageClear();\n  const db=await imageDb();return new Promise((resolve,reject)=>{const tx=db.transaction(IMAGE_STORE,'readwrite');tx.objectStore(IMAGE_STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});\n}",'clearImageStore');
  html=html.slice(0,p.open)+app+html.slice(p.end);
}
{
  const p=script('data-tr-backup-v2-runtime=');
  let b=p.text;
  const old="async function trBackupV2ImageWriteTransaction(puts=[],deletes=[]){\n  const db=await imageDb();return new Promise((resolve,reject)=>{\n    let tx;try{\n      tx=db.transaction(IMAGE_STORE,'readwrite');const store=tx.objectStore(IMAGE_STORE);\n      for(const rec of puts)store.put(rec);for(const id of deletes)store.delete(id);\n    }catch(e){try{tx?.abort();}catch{}reject(e);return;}\n    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Transacción de imágenes abortada.'));\n  });\n}";
  const neu="async function trBackupV2ImageWriteTransaction(puts=[],deletes=[]){\n  if(globalThis.TradingResearchDesktopImageAuthority?.migrationPending)throw new Error('Migración nativa de imágenes en curso.');\n  if(globalThis.TradingResearchDesktopImageAuthority?.active)return await trDesktopImageWriteTransaction(puts,deletes,'backup-v2.images');\n  const db=await imageDb();return new Promise((resolve,reject)=>{\n    let tx;try{\n      tx=db.transaction(IMAGE_STORE,'readwrite');const store=tx.objectStore(IMAGE_STORE);\n      for(const rec of puts)store.put(rec);for(const id of deletes)store.delete(id);\n    }catch(e){try{tx?.abort();}catch{}reject(e);return;}\n    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Transacción de imágenes abortada.'));\n  });\n}";
  b=replaceOnce(b,old,neu,'BackupV2 image transaction');
  html=html.slice(0,p.open)+b+html.slice(p.end);
}
{
  const p=script('data-tr-blob-lifecycle-runtime=');
  let b=p.text;
  const old="async function trBlobGcDeleteLocalIds(ids){\n  const targets=trBlobGcUniqueIds(ids).filter(id=>!id.startsWith(trBlobGcStagePrefix()));\n  if(!targets.length)return 0;\n  const db=await imageDb();\n  return new Promise((resolve,reject)=>{\n    let tx;try{\n      tx=db.transaction(IMAGE_STORE,'readwrite');const store=tx.objectStore(IMAGE_STORE);\n      for(const id of targets)store.delete(id);\n    }catch(e){try{tx?.abort();}catch{}reject(e);return;}\n    tx.oncomplete=()=>resolve(targets.length);\n    tx.onerror=()=>reject(tx.error||new Error('GC local de blobs falló.'));\n    tx.onabort=()=>reject(tx.error||new Error('GC local de blobs abortado.'));\n  });\n}";
  const neu="async function trBlobGcDeleteLocalIds(ids){\n  const targets=trBlobGcUniqueIds(ids).filter(id=>!id.startsWith(trBlobGcStagePrefix()));\n  if(!targets.length)return 0;\n  if(globalThis.TradingResearchDesktopImageAuthority?.migrationPending)throw new Error('Migración nativa de imágenes en curso.');\n  if(globalThis.TradingResearchDesktopImageAuthority?.active)return await trDesktopImageGcDeleteLocalIds(targets);\n  const db=await imageDb();\n  return new Promise((resolve,reject)=>{\n    let tx;try{\n      tx=db.transaction(IMAGE_STORE,'readwrite');const store=tx.objectStore(IMAGE_STORE);\n      for(const id of targets)store.delete(id);\n    }catch(e){try{tx?.abort();}catch{}reject(e);return;}\n    tx.oncomplete=()=>resolve(targets.length);\n    tx.onerror=()=>reject(tx.error||new Error('GC local de blobs falló.'));\n    tx.onabort=()=>reject(tx.error||new Error('GC local de blobs abortado.'));\n  });\n}";
  b=replaceOnce(b,old,neu,'Blob lifecycle native GC');
  html=html.slice(0,p.open)+b+html.slice(p.end);
}
html=html.replace('</head>',()=>'<meta name="trading-research-desktop-native-images" content="0.5.0-b77" />\n</head>');
fs.writeFileSync(file,html);
console.log('Batch 77 Desktop artifact routes live image IO/BackupV2/GC to native authority only when promoted; Web unchanged.');
