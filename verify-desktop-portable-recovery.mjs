import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime=fs.readFileSync('desktop-portable-recovery-runtime.js','utf8');
const main=fs.readFileSync('src-tauri/src/main.rs','utf8');
const prepare=fs.readFileSync('desktop-prepare.mjs','utf8');
const market=fs.readFileSync('desktop-native-market-runtime.js','utf8');
const web=fs.readFileSync('app.js','utf8');

for(const token of [
  'desktop_portable_restore_begin','desktop_portable_restore_status','desktop_portable_restore_advance',
  'desktop_portable_restore_clear','desktop_read_native_backup_chunk'
])assert(main.includes(token),'Missing native portable recovery command '+token);

for(const token of [
  'portable_restore_journal','portable-restore.marker','prepared","restored","images-native","market-native","verified',
  'canonical_native_backup_path','DESKTOP_BACKUP_STREAM_CHUNK_MAX'
])assert(main.includes(token),'Missing native portable invariant '+token);

for(const token of [
  "streamBackupText","readNativeBackupText","resumePending","runRestoreProtocol",
  "ensureNativeImages","ensureNativeMarket","finalVerify","sameHashes",
  "desktop-portable-restore-probe","desktop-portable-restore"
])assert(runtime.includes(token),'Missing portable runtime invariant '+token);

assert(runtime.includes("trBackupV2Preflight")&&runtime.includes("trBackupV2BuildPayload"),'Portable restore must preflight source and rebuild final Backup V2.');
assert(runtime.includes("TradingResearchDesktopNativeImages")&&runtime.includes("TradingResearchDesktopNativeMarketData"),'Portable restore must converge both native authorities.');
assert(runtime.includes("sourcePath")&&runtime.includes("rollbackPath"),'Portable journal must bind both physical backups.');
assert(runtime.includes("finalVerify(prepared)")&&runtime.includes("sameHashes(prepared.manifest?.hashes,rebuilt.manifest?.hashes)"),'Final restore must require exact Backup V2 domain hashes.');
assert(prepare.includes('desktop-portable-recovery-runtime.js')&&prepare.includes('data-tr-desktop-portable-recovery="batch79"'),'Desktop artifact must embed portable recovery runtime.');
assert(market.includes('Market Data todavía usa IndexedDB.'),'Batch 78 Verify UX silence must be fixed.');
assert(!web.includes('desktop_portable_restore_begin')&&!web.includes('desktop-portable-recovery'),'Web source must remain isolated from Desktop portable recovery.');
console.log('Batch 79 portable recovery static boundary PASS.');
