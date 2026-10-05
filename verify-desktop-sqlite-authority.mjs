/* Desktop 0.4 authority wiring gate. The Web build must remain unchanged.
 * Passing this gate is necessary but not sufficient: Rust behavioral tests and
 * manual offline upgrade/recovery are also required before merge.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = path => fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
const main=read('src-tauri/src/main.rs');
const schema=read('src-tauri/src/authority.rs');
const bridge=read('desktop-authority-bridge.js');
const transform=read('desktop-authority-transform.mjs');
const html=read('desktop-dist/index.html');
const web=read('app.js');
const config=read('src-tauri/tauri.conf.json');
const docs=read('DESKTOP-SQLITE-AUTHORITY.md');
const fail=message=>{throw new Error('Batch 76 SQLite authority: '+message);};
if(!docs.includes('No promotion if'))fail('Migration safety contract missing.');
if(!schema.includes('workspace_authority')||!schema.includes('revision')||!schema.includes('rollback_path'))fail('SQLite authority schema missing.');
for(const name of ['desktop_promote_workspace_authority','desktop_commit_authoritative_workspace','desktop_read_authoritative_workspace','desktop_authority_status']){
  if(!main.includes(name))fail('Native handler missing: '+name);
  if(!bridge.includes(name)&&name!=='desktop_authority_status'&&!read('desktop-native-runtime.js').includes(name))fail('Desktop bridge cannot call '+name);
}
if(!main.includes('PRAGMA synchronous=FULL'))fail('SQLite full-sync durability missing.');
if(!main.includes('sqlite-authority.marker')||!main.includes('guarded_authority_status')||!main.includes('file.sync_all()'))fail('Independent fail-closed authority marker missing.');
if(!schema.includes('Sha256')||!schema.includes('transaction()')||!schema.includes('expected_revision'))fail('Native integrity/CAS boundary incomplete.');
if(!schema.includes('verify_rollback')||!main.includes('authority::verify_rollback'))fail('No verified physical rollback gate.');
if(!bridge.includes('trBackupV2Preflight(backup)')||!bridge.includes('desktop_write_backup')||!bridge.includes('desktop_promote_workspace_authority'))fail('Backup V2 promotion sequence missing.');
const order=['trBackupV2Preflight(backup)',"desktop_write_backup","desktop_promote_workspace_authority"].map(x=>bridge.indexOf(x));
if(order.some(x=>x<0)||!(order[0]<order[1]&&order[1]<order[2]))fail('Promotion runs before certified physical backup.');
if(!bridge.includes('desktop_read_authoritative_workspace')||!bridge.includes('trCoreBootstrapIndexedDb()')||!bridge.includes("trCoreMode='sqlite-authority'"))fail('Early boot authority/readback is missing.');
if(!bridge.includes('trDesktopAuthorityQueueStateWrite')||!bridge.includes('expectedRevision:previous')||!bridge.includes('trDesktopAuthorityFailed'))fail('Durable serialized CAS/error gate missing.');
if(!transform.includes("desktop-dist/index.html")||!transform.includes('desktop-authority-bridge.js'))fail('Desktop-only source transform not wired.');
if(web.includes('TradingResearchDesktopAuthority'))fail('Web source contains Desktop authority changes.');
if(!html.includes('name="trading-research-desktop-authority" content="0.4.0"'))fail('Desktop authority artifact marker missing.');
if(!html.includes('exclusive abortada; flush no confirmado'))fail('Desktop exclusive operations ignore failed flush.');
for(const token of ['trCoreBootstrapIndexedDb','trDesktopAuthorityBootstrap','desktop_commit_authoritative_workspace','desktop_read_authoritative_workspace',"trCoreMode='sqlite-authority'"]){
  if(!html.includes(token))fail('Generated Desktop artifact is missing '+token);
}
if(!config.includes('"version": "0.5.1"'))fail('Desktop package version 0.5.1 not configured; SQLite authority contract marker remains 0.4.0.');
assert(!html.includes('cdn.jsdelivr.net/npm/@supabase/'),'Desktop must remain offline.');
console.log('Desktop 0.4 SQLite authority wiring gate OK: only desktop-dist routes native boot/commit, backup before promotion, no Web mutation.');
