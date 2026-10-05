import fs from 'node:fs';
import assert from 'node:assert/strict';

const main=fs.readFileSync('src-tauri/src/main.rs','utf8');
const market=fs.readFileSync('src-tauri/src/native_market.rs','utf8');
const app=fs.readFileSync('app.js','utf8');
const spec=fs.readFileSync('DESKTOP-NATIVE-MARKETDATA.md','utf8');

for(const cmd of [
  'desktop_market_begin_staging',
  'desktop_market_stage_meta',
  'desktop_market_stage_exec',
  'desktop_market_stage_tick_chunk',
  'desktop_market_finalize_dataset',
  'desktop_market_verify_staging',
  'desktop_market_read_staged_chunk',
  'desktop_market_staging_status'
]){
  assert(main.includes(cmd),'Missing Batch 78 staging RPC: '+cmd);
  assert(!app.includes(cmd),'Web app must never call Desktop Market Data RPC directly: '+cmd);
}
assert(main.includes('validated_native_backup(&root,&rollback_path)'),'Market staging must be bound to a validated physical Backup V2 rollback.');
assert(market.includes('MAX_CHUNK_ROWS: usize = 25_000'),'Native tick IPC chunk must stay bounded to 25,000 rows.');
assert(market.includes('MAX_DATASET_ROWS: usize = 2_000_000'),'Existing 2,000,000-tick dataset limit must be retained.');
for(const invariant of [
  'market_stage_state','market_meta_native','market_exec_native','market_tick_chunk_native','market_tick_catalog_native',
  'Chunk fuera de orden','Chunk ya existe con contenido distinto','Hash chunk ticks no coincide',
  'marketMeta y marketTicks no forman pares exactos','execSet'
]){
  assert(market.includes(invariant),'Missing Market Data staging invariant: '+invariant);
}
assert(!/pub\(crate\)\s+fn\s+promote\b/.test(market),'Batch 78 staging foundation must not expose authority promotion yet.');
assert(!/desktop_market_promote/.test(main),'Desktop must not expose Market Data promotion before migration adapter/restore gates exist.');
assert(app.includes("const V314_TICK_CACHE_MAX_TICKS=2000000;"),'Legacy bounded tick cache contract changed.');
assert(app.includes("const V314_DB_NAME='tradingResearchMarketDataV2';"),'Web IndexedDB Market Data source must remain intact in staging phase.');
assert(spec.includes('25,000')&&spec.includes('Batch 79'),'Batch 78 rollout contract missing bounded chunks or later cold-recovery boundary.');
console.log('Batch 78 native Market Data STAGING gate PASS — authority not promoted; Web IndexedDB unchanged.');
