/* Batch 76 · RED contract: Desktop 0.4 must not declare SQLite authoritative
 * until an early Desktop boot gate, native transactional API and synchronous
 * durable acknowledgement have been implemented. Intentionally fails on 0.3.1.
 * Future GREEN requires behavior tests in addition to these wiring assertions.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.existsSync(path) ? fs.readFileSync(path,'utf8') : '';
const native=read('src-tauri/src/main.rs');
const desktop=read('desktop-native-runtime.js');
const prepare=read('desktop-prepare.mjs');
const app=read('app.js');
const config=read('src-tauri/tauri.conf.json');
const docs=read('DESKTOP-SQLITE-AUTHORITY.md');
const fail=(message)=>{throw new Error('Batch 76 SQLite authority RED: '+message);};
if(!docs.includes('No promotion if')&&!docs.includes('No promotion'))fail('Migration safety contract missing.');
for(const name of ['workspace_authority','desktop_promote_workspace_authority','desktop_commit_authoritative_workspace','desktop_read_authoritative_workspace','desktop_authority_status']){
  if(!native.includes(name))fail('Missing native authority schema/API: '+name);
}
if(!native.includes('PRAGMA synchronous=FULL'))fail('SQLite full-sync durability missing.');
if(!native.includes('sha256_text'))fail('Native content hash missing.');
if(!native.includes('transaction()'))fail('Native commit transaction missing.');
if(!/revision|expected_revision/.test(native))fail('Authority revision / CAS missing.');
if(!prepare.includes('trading-research-desktop-authority'))fail('Desktop-only early bootstrap contract missing.');
if(!desktop.includes('sqlite-authority'))fail('Desktop runtime does not identify SQLite authority.');
if(!app.includes('TradingResearchDesktopAuthority'))fail('Shared boot/persistence boundary does not support an explicit Desktop adapter.');
if(!app.includes('desktop_read_authoritative_workspace'))fail('Desktop boot does not read its SQLite source of truth.');
if(!app.includes('desktop_commit_authoritative_workspace'))fail('Desktop persistence is not committed through SQLite.');
if(!app.includes('desktop_promote_workspace_authority'))fail('Migration is not wired to the Desktop boot boundary.');
if(!config.includes('"version": "0.4.0"'))fail('Desktop version 0.4.0 is not configured.');
// The existing native mirror is not a source-of-truth: proving it exists is insufficient.
assert(!(/desktop_mirror_workspace/.test(native)&&!/desktop_commit_authoritative_workspace/.test(native)));
console.log('Batch 76 SQLite authority wiring contract OK. Run behavioral/native gates before promotion.');
