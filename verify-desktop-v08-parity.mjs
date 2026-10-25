import fs from 'node:fs';
import assert from 'node:assert/strict';

// Candidate 0.8 upgrades the installed Tauri shell; it does not migrate,
// regenerate or normalize a user's stored workspace.
const web=fs.readFileSync('dist/index.html','utf8');
const desktop=fs.readFileSync('desktop-dist/index.html','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const tauri=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
const cargo=fs.readFileSync('src-tauri/Cargo.toml','utf8');
const prepare=fs.readFileSync('desktop-prepare.mjs','utf8');
const runtime=fs.readFileSync('desktop-native-runtime.js','utf8');
const portable=fs.readFileSync('desktop-portable-recovery-runtime.js','utf8');
const sourceBackup=fs.readFileSync('backup-v2-runtime.js','utf8');
const workflow=fs.readFileSync('.github/workflows/desktop-build.yml','utf8');
const style=html=>html.match(/<style data-tr-build="[^"]+">([\s\S]*?)<\/style>/)?.[1];

assert.equal(pkg.version,'31.29.0','Keep the independently certified Web product version');
assert.equal(tauri.version,'0.8.0');
assert(cargo.includes('version = "0.8.0"'),'Tauri and Cargo versions must match');
assert.equal(tauri.identifier,'app.tradingresearch.desktop','Preserve Windows AppLocalData identity and in-place upgrade path');
assert.deepEqual(tauri.bundle.targets,['nsis'],'Keep the NSIS installer type and the previous product identity');
assert.equal(tauri.build.frontendDist,'../desktop-dist');
assert.equal(style(desktop),style(web),'Desktop must inherit exactly the verified web styles, including light/dark themes');
for(const marker of ['TradingResearchAstraLote2','TradingResearchAstraLote3',
 'TradingResearchAstraLote4','TradingResearchAstraLote5',
 'TradingResearchAstraLote6','TradingResearchAstraLote7','TradingResearchAstraLote8']){
 assert(web.includes(marker),marker+' missing from certified Web build');
 assert(desktop.includes(marker),marker+' missing from desktop build');
}
for(const token of ['--tr8-info-circle','.tr8-week-selector','.tr8-week-day','html[data-theme="light"]']){
 assert(style(desktop).includes(token),'Desktop is missing UI/UX theme or Lote 8 visual token: '+token);
}
assert(desktop.includes('name="trading-research-desktop-channel" content="0.8.0"'));
assert(desktop.includes('data-tr-desktop-native-storage="0.8.0"'));
for(const token of ['data-tr-desktop-native-images','data-tr-desktop-native-marketdata','data-tr-desktop-portable-recovery']){
 assert(desktop.includes(token),'Native capability missing: '+token);
}
assert(runtime.includes("const VERSION='0.8.0'"));
assert(runtime.includes('if(document.getElementById(\'trDesktopNativeStorage\'))return;'),
 'Native storage panel must remain idempotent (prior restore freeze regression)');
assert(sourceBackup.includes('async function trBackupV2RestoreProtocol('));
assert(sourceBackup.includes('async function trBackupV2RecoverPending('));
assert(sourceBackup.includes('trBackupV2SetRecoveryUiBlocked'));
assert(desktop.includes('trBackupV2RestoreProtocol')&&desktop.includes('trBackupV2RefreshUiAfterRestore'),
 'The bundled Desktop must retain the recoverable Backup V2 protocol');
for(const term of ['desktop_portable_restore_status','desktop_portable_restore_advance','desktop_portable_restore_clear',
 'releaseWriteBlock','holdRecoveryBlock','trBackupV2RestoreProtocol']){
 assert(portable.includes(term),'Interrupted portable recovery contract missing: '+term);
}
assert(prepare.includes("fs.cpSync(sourceDir,desktopDir,{recursive:true})"),
 'Native frontend must copy the complete certified Web dist');
assert(!/<(?:script|img|link)[^>]+(?:src|href)=["']https?:\/\//i.test(desktop),
 'Offline Desktop must not depend on remote HTML assets');
assert(workflow.includes('TradingResearch-Desktop-0.8.0-Windows-x64'),
 'Windows CI artifact must identify this upgrade');
console.log('Desktop 0.8.0 parity PASS: Lotes 0-8 styles/runtime, unchanged app identity, native authorities, offline and resumable Backup V2');
