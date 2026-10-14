/* Desktop 0.8.0: byte-level parity with approved Web PR1-4 frontend.
 * Desktop authority transforms may change app/state/image/market scripts only. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const read=name=>fs.readFileSync(name,'utf8');
const web=read('dist/index.html'),desktop=read('desktop-dist/index.html');
const config=JSON.parse(read('src-tauri/tauri.conf.json'));
const cargo=read('src-tauri/Cargo.toml');
const prep=read('desktop-prepare.mjs');
const nativeUi=read('desktop-native-runtime.js');
const nativeHost=read('src-tauri/src/main.rs');
const sha=s=>crypto.createHash('sha256').update(s,'utf8').digest('hex');
function tagBody(html,tag,attr){
 const pattern=new RegExp('<'+tag+'\\s+'+attr+'="[^"]+"[^>]*>([\\s\\S]*?)<\\/'+tag+'>','g');
 const found=[...html.matchAll(pattern)];
 assert.equal(found.length,1,attr+': expected one embedded '+tag+'; found '+found.length);
 return found[0][1];
}
const cssWeb=tagBody(web,'style','data-tr-build');
const cssDesktop=tagBody(desktop,'style','data-tr-build');
const uiWeb=tagBody(web,'script','data-tr-render-closure-runtime');
const uiDesktop=tagBody(desktop,'script','data-tr-render-closure-runtime');
assert.equal(sha(cssWeb),sha(cssDesktop),'Desktop CSS differs from approved Web release.');
assert.equal(sha(uiWeb),sha(uiDesktop),'Desktop UI adapter bundle differs from approved Web release.');
const mandatory={
 'PR1 navigation and columns':['TradingResearchOperationColumns','tr6-lab-navigation'],
 'PR2 lots and dashboard':['TradingResearchLotExecution','data-trcomp-widget'],
 'PR3 builder and OOS':['TradingResearchVisualPR3','TradingResearchBuilderColumnContract',"['oos','OOS','Hipótesis congeladas']"],
 'PR4 plans, writing and reports':['TradingResearchVisualPR4','trvis4-report-document']
};
for(const [name,tokens] of Object.entries(mandatory))
 for(const token of tokens)
  assert(uiWeb.includes(token)||cssWeb.includes(token),name+': missing '+token);
const backupWeb=tagBody(web,'script','data-tr-backup-v2-runtime');
const backupDesktop=tagBody(desktop,'script','data-tr-backup-v2-runtime');
assert(backupWeb.includes('trBackupV2BuildPayload'),'Web Backup V2 builder missing');
assert(backupDesktop.includes('trBackupV2BuildPayload'),'Desktop native Backup V2 builder missing');
const webApp=tagBody(web,'script','data-tr-build');
const desktopApp=tagBody(desktop,'script','data-tr-build');
for(const token of ['trCoreBootstrap','trCorePersistNow','v314StorePut','storeImageFile']){
 assert(webApp.includes(token),'Missing Web application contract: '+token);
 assert(desktopApp.includes(token),'Native rewrite removed application contract: '+token);
}
for(const marker of [
 'trading-research-desktop-channel" content="0.8.0"',
 'data-tr-desktop-native-storage="0.8.0"',
 'trading-research-desktop-authority" content="0.4.0"',
 'data-tr-desktop-native-images="batch77-staging"',
 'data-tr-desktop-native-marketdata="batch78"',
 'data-tr-desktop-portable-recovery="batch79"'
])assert(desktop.includes(marker),'Missing Desktop version/authority marker '+marker);
assert.equal(config.version,'0.8.0');
assert.match(cargo,/^version\s*=\s*"0\.8\.0"/m);
assert(nativeUi.includes("const VERSION='0.8.0'"),'Native desktop panel reports old version');
assert(nativeHost.includes('"version": "0.8.0"'),'Native host status reports old version');
assert.equal(config.identifier,'app.tradingresearch.desktop','Installation ID changed: existing AppLocalData must remain accessible');
assert.equal(config.build.frontendDist,'../desktop-dist');
assert.equal(config.app.withGlobalTauri,true);
assert(config.bundle.targets.includes('nsis'),'Offline Windows installer must be NSIS.');
assert(prep.includes('fs.cpSync(sourceDir,desktopDir'),'Desktop must start from approved Web output.');
assert(!/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/i.test(desktop),'Supabase CDN present offline.');
assert(!/<(?:script|img|link)[^>]+(?:src|href)=["']https?:\/\//i.test(desktop),'External UI resource in Desktop.');
assert(!/@import\s+url\(\s*["']?https?:\/\//i.test(cssDesktop),'Remote CSS import.');
console.log('Desktop 0.8 PR1–4 parity PASS',JSON.stringify({
 desktopVersion:config.version,sharedWebVersion:JSON.parse(read('package.json')).version,
 uiBundleSha256:sha(uiWeb),styleSha256:sha(cssWeb),
 nativeAdapters:['SQLite workspace','native images','native Market Data','portable Backup V2'],
 features:Object.keys(mandatory)
}));
