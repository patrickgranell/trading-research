import fs from 'node:fs';
import assert from 'node:assert/strict';

const runtime=fs.readFileSync('desktop-portable-recovery-runtime.js','utf8');
const main=fs.readFileSync('src-tauri/src/main.rs','utf8');
const prepare=fs.readFileSync('desktop-prepare.mjs','utf8');
const market=fs.readFileSync('desktop-native-market-runtime.js','utf8');
const web=fs.readFileSync('app.js','utf8');
const built=fs.readFileSync('desktop-dist/index.html','utf8');

for(const token of [
  'desktop_portable_restore_begin','desktop_portable_restore_status','desktop_portable_restore_advance',
  'desktop_portable_restore_clear','desktop_read_native_backup_chunk','desktop_market_backup_ticks_hash'
])assert(main.includes(token),'Missing native portable recovery command '+token);

for(const token of [
  'portable_restore_journal','portable-restore.marker','prepared","restored","images-native","market-native","verified',
  'canonical_native_backup_path','DESKTOP_BACKUP_STREAM_CHUNK_MAX'
])assert(main.includes(token),'Missing native portable invariant '+token);

for(const token of [
  "streamBackupText","readNativeBackupText","resumePending","recoverOrRunRestore",
  "ensureWorkspaceAuthority","ensureNativeImages","ensureNativeMarket","finalVerify","sameHashes",
  "desktop-portable-restore-probe","desktop-portable-restore"
])assert(runtime.includes(token),'Missing portable runtime invariant '+token);

assert(runtime.includes("trBackupV2Preflight")&&runtime.includes("trBackupV2BuildPayload"),'Portable restore must preflight source and rebuild final Backup V2.');
assert(runtime.includes("trBackupV2JournalGet")&&runtime.includes("trBackupV2RecoverPending"),'Portable restore must serialize/resume the underlying Backup V2 journal before advancing.');
assert(runtime.includes("TradingResearchDesktopNativeImages")&&runtime.includes("TradingResearchDesktopNativeMarketData"),'Portable restore must converge both native authorities.');
assert(runtime.includes("desktop_promote_workspace_authority")&&runtime.includes("refreshFromNative"),'Fresh target must be able to promote and adopt SQLite workspace authority from source Backup V2.');
assert(!runtime.includes("SQLite workspace authority todavía no está activa. No se inicia el restore portable."),'Portable recovery must not reject a truly fresh target solely because workspace authority is inactive.');
assert(runtime.includes("sourcePath")&&runtime.includes("rollbackPath"),'Portable journal must bind both physical backups.');
assert(runtime.includes("finalVerify(prepared)")&&runtime.includes("desktop_market_backup_ticks_hash")&&runtime.includes("trBackupV2HashCanonical(metaRows)"),'Final restore must require exact Backup V2 domain hashes without rebuilding all tick history in WebView memory.');
const finalBody=runtime.slice(runtime.indexOf('async function finalVerify'),runtime.indexOf('async function execute'));
assert(!finalBody.includes('trBackupV2BuildPayload'),'Final portable verification must not rebuild the full Backup V2 payload in WebView memory.');
assert(prepare.includes('desktop-portable-recovery-runtime.js')&&prepare.includes('data-tr-desktop-portable-recovery="batch79"'),'Desktop artifact must embed portable recovery runtime.');
assert(built.includes('data-tr-desktop-portable-recovery="batch79"')&&built.includes('desktop_portable_restore_begin'),'Generated Desktop artifact must contain the Batch 79 runtime and native command contract.');
assert(market.includes('Market Data todavía usa IndexedDB.'),'Batch 78 Verify UX silence must be fixed.');
assert(!web.includes('desktop_portable_restore_begin')&&!web.includes('desktop-portable-recovery'),'Web source must remain isolated from Desktop portable recovery.');
console.log('Batch 79 portable recovery static boundary PASS.');
