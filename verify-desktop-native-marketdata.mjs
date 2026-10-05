import fs from 'node:fs';
import assert from 'node:assert/strict';

const main=fs.readFileSync('src-tauri/src/main.rs','utf8');
const market=fs.readFileSync('src-tauri/src/native_market.rs','utf8');
const app=fs.readFileSync('app.js','utf8');
const state=fs.readFileSync('state-runtime.js','utf8');
const backup=fs.readFileSync('backup-v2-runtime.js','utf8');
const bridge=fs.readFileSync('desktop-authority-bridge.js','utf8');
const runtime=fs.readFileSync('desktop-native-market-runtime.js','utf8');
const transform=fs.readFileSync('desktop-native-market-transform.mjs','utf8');
const spec=fs.readFileSync('DESKTOP-NATIVE-MARKETDATA.md','utf8');

const staging=[
  'desktop_market_begin_staging','desktop_market_stage_meta','desktop_market_stage_exec',
  'desktop_market_stage_tick_chunk','desktop_market_finalize_dataset','desktop_market_verify_staging',
  'desktop_market_read_staged_chunk','desktop_market_staging_status'
];
const authority=[
  'desktop_market_authority_status','desktop_market_promote_authority','desktop_market_list_records',
  'desktop_market_get_record','desktop_market_list_catalogs','desktop_market_read_active_chunk',
  'desktop_market_begin_live_op','desktop_market_stage_live_record','desktop_market_stage_live_delete',
  'desktop_market_stage_live_tick_chunk','desktop_market_finalize_live_tick',
  'desktop_market_commit_live_op','desktop_market_abort_live_op'
];
for(const cmd of [...staging,...authority]){
  assert(main.includes(cmd),'Missing Batch 78 native RPC: '+cmd);
  assert(!app.includes(cmd),'Web app must never call Desktop Market Data RPC directly: '+cmd);
}
assert(main.includes('validated_native_backup(&root,&rollback_path)'),'Market staging/promotion must be bound to a validated physical Backup V2 rollback.');
assert(market.includes('MAX_CHUNK_ROWS: usize = 25_000'),'Native tick IPC chunk must stay bounded to 25,000 rows.');
assert(market.includes('MAX_DATASET_ROWS: usize = 2_000_000'),'Existing 2,000,000-tick dataset limit must be retained.');
for(const invariant of [
  'market_stage_state','market_meta_native','market_exec_native','market_tick_chunk_native','market_tick_catalog_native',
  'market_meta_active','market_exec_active','market_tick_chunk_active','market_tick_catalog_active',
  'market_pending_op','market_pending_tick_chunk','market_authority_native',
  'native-market-authority.marker','verify_stage_inventory','ensure_authority_marker','commit_live_op',
  'Chunk fuera de orden','Chunk ya existe con contenido distinto','Hash chunk ticks no coincide',
  'marketMeta y marketTicks no forman pares exactos','execSet'
]){
  assert(market.includes(invariant),'Missing Market Data authority invariant: '+invariant);
}
assert(/pub\(crate\)\s+fn\s+promote\b/.test(market),'Market Data promotion contract missing.');
assert(main.includes('desktop_market_promote_authority'),'Desktop Market Data promotion RPC missing.');
assert(bridge.includes('TradingResearchDesktopMarketAuthority')&&bridge.includes('TradingResearchDesktopMarketBridge'),'Desktop Market Data authority bridge missing.');
assert(bridge.includes("await trDesktopMarketBootstrapAuthority();"),'Market Data authority must bootstrap before UI.');
assert(bridge.includes("trDesktopAuthorityStop(e,'Market Data')"),'Market Data authority corruption must fail closed on its own boundary.');
assert(bridge.includes('offset+=25000'),'Live native Market Data bridge must chunk tick IPC at 25,000 rows.');
assert(runtime.includes("label:'desktop-market-stage-rollback'"),'Market Data migration must create physical Backup V2 rollback before staging.');
assert(runtime.includes('desktop_market_verify_staging')&&runtime.includes('desktop_market_promote_authority'),'Market migration must verify staging before explicit promotion.');
assert(runtime.includes("desktop_market_authority_status',{deep:true}"),'Market migration must deep-read native authority after promotion.');
assert(runtime.includes("before.marketMeta!==after.marketMeta")&&runtime.includes("before.marketTicks!==after.marketTicks")&&runtime.includes("before.execSets!==after.execSets"),'Post-promotion Backup V2 exactness gate missing.');
assert(runtime.includes("if(document.getElementById('desktop-native-market-host'))return;"),'Market panel MutationObserver must not repaint an already-mounted host.');
assert(transform.includes('TradingResearchDesktopMarketAuthority?.active'),'Desktop routing transform must be conditional on promoted native authority.');
assert(transform.includes("TradingResearchDesktopMarketBridge.applyChanges(list,'state-runtime.market-batch')"),'Grouped import transaction must route to native CAS.');
assert(transform.includes('TradingResearchDesktopMarketBridge.replaceAll(marketData)'),'Backup V2 Market Data restore must route to native replacement.');
assert(transform.includes('TradingResearchDesktopMarketBridge.deleteDataset(id)'),'Historical meta+ticks deletion must remain grouped.');
assert(app.includes("const V314_TICK_CACHE_MAX_TICKS=2000000;"),'Legacy bounded tick cache contract changed.');
assert(app.includes("const V314_DB_NAME='tradingResearchMarketDataV2';"),'Web IndexedDB Market Data source must remain intact.');
assert(!state.includes('TradingResearchDesktopMarketBridge'),'Web state-runtime source must remain free of Desktop bridge code.');
assert(!backup.includes('TradingResearchDesktopMarketBridge'),'Web Backup V2 source must remain free of Desktop bridge code.');
assert(spec.includes('25,000')&&spec.includes('Batch 79'),'Batch 78 rollout contract missing bounded chunks or later cold-recovery boundary.');

if(fs.existsSync('desktop-dist/index.html')){
  const html=fs.readFileSync('desktop-dist/index.html','utf8');
  assert(html.includes('data-tr-desktop-native-marketdata="batch78"'),'Desktop artifact missing Market Data migration runtime.');
  assert(html.includes('trading-research-desktop-native-marketdata'),'Desktop artifact missing native Market Data marker.');
  assert(html.includes('TradingResearchDesktopMarketBridge.put(store,value)'),'Desktop v314StorePut not routed after promotion.');
  assert(html.includes('TradingResearchDesktopMarketBridge.all(store)'),'Desktop v314StoreAll not routed after promotion.');
  assert(html.includes("TradingResearchDesktopMarketBridge.applyChanges(list,'state-runtime.market-batch')"),'Desktop atomic import not routed.');
  assert(html.includes('TradingResearchDesktopMarketBridge.replaceAll(marketData)'),'Desktop Backup V2 replacement not routed.');
}
console.log('Batch 78 native Market Data authority gate PASS — bounded IPC, rollback-first promotion, CAS routing and Web isolation.');
