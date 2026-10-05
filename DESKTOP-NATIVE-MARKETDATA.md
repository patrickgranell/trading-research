# Batch 78 · Desktop 0.6 — native Market Data (DRAFT / staged rollout)

Base: certified Batch 77 merge `943f711e589e268dfd7e10060832ab1ae5c56a99`.

## Current boundary

Desktop 0.5.1 is certified with:
- SQLite as workspace authority.
- Native content-addressed image authority.
- Market Data still in WebView IndexedDB `tradingResearchMarketDataV2`:
  - `marketMeta`
  - `marketTicks`
  - `execSets`

The legacy runtime accepts at most 2,000,000 ticks per imported dataset and keeps an LRU cache bounded to 2 datasets / 2,000,000 ticks. Historical imports publish `marketMeta` + `marketTicks` atomically through the state-runtime staging layer. Grid imports can update `execSets` and the workspace in one controlled import boundary.

## Batch 78 target

Promote Market Data to a native authority without changing financial calculations, parsing, calibration logic, Running P&L, reconciliation semantics, Web behavior, or the existing workspace/image authorities.

### Storage model

- SQLite stores authority/generation metadata, Market Data metadata, exec sets and per-dataset chunk catalogs.
- Tick payloads are stored in bounded SQLite chunks, never transferred in one unbounded Tauri IPC call.
- Target chunk size: at most 25,000 ticks per bridge call.
- Each chunk has:
  - generation
  - dataset id
  - contiguous chunk index
  - row count
  - canonical JSON payload
  - SHA-256
- Each dataset catalog binds:
  - chunk count
  - total row count
  - aggregate SHA derived from the ordered chunk hashes + row counts.
- IDs remain opaque data; no Market Data ID becomes a filesystem path.

### Migration contract

1. Keep IndexedDB authoritative until migration is explicitly promoted.
2. Flush the current workspace and build/preflight a complete Backup V2.
3. Persist an fsync-confirmed native rollback before staging any Market Data authority.
4. Snapshot all three legacy stores.
5. Stage `marketMeta`, tick datasets in bounded chunks, and `execSets`.
6. Verify:
   - unique IDs,
   - exact meta/tick pairing,
   - every chunk hash,
   - contiguous chunk indexes,
   - dataset row counts,
   - execSet references to existing Market Data IDs,
   - exact staged-vs-legacy inventory hashes.
7. Publish an external AppLocalData marker before switching the SQLite authority generation.
8. Once promoted, no silent fallback to stale Market Data IndexedDB is allowed.
9. Interrupted staging is resumable/idempotent and not considered authority.
10. Missing/corrupt native authority fails closed and preserves Backup V2 rollback.

### Live native adapter

After promotion, Desktop routes `v314StorePut/Get/All/Delete` to the native authority:
- `marketMeta` and `execSets`: bounded JSON records.
- `marketTicks`: paged chunk reads/writes; `v314LoadTicks` may reconstruct one dataset in memory because the existing 2,000,000-tick bound remains enforced.
- Historical import preserves the atomic `marketMeta + marketTicks` commit property.
- Grid import preserves the existing domain + Market Data rollback semantics.
- Delete of a Market Data dataset removes meta + tick catalog/chunks atomically and does not leave execSet references silently broken.
- Backup V2 and restore enumerate native Market Data through bounded chunk iteration. Web continues to use IndexedDB unchanged.

## Automated gates before any installer

- Rust:
  - chunk write/read hash roundtrip,
  - max chunk bound,
  - duplicate/out-of-order chunk rejection,
  - exact row-count verification,
  - corrupt payload detection,
  - stale generation/CAS rejection,
  - restart with real SQLite file,
  - marker-without-authority fail closed,
  - staged generation never visible as live authority.
- JS:
  - Desktop-only routing,
  - no Web source changes,
  - bounded 25k chunk calls,
  - legacy import transaction semantics retained,
  - LRU 2M tick bound retained,
  - Backup V2 and restore exactness.
- Windows exact-head build and installer.

## Manual budget

One grouped offline session only after all automated gates are green:
1. install Desktop 0.6 over 0.5.1 without deleting AppData;
2. migrate existing Market Data;
3. verify expected historical/Grid counts and native generation;
4. close/reopen and verify again;
5. open one existing calibration/running-P&L dataset to prove native reads.

No destructive restore is required in Batch 78 unless an automated gate specifically exposes a recovery defect. Batch 79 remains the full cold-recovery/portability certification.
