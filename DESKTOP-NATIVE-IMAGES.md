# Batch 77 · Desktop 0.5 — native image storage (DRAFT / migration contract)

Base: certified PR #90 merge `ac31366265e9d73f3d93fc98420b60bfee3aed30`. No modifications to Web, Supabase, financial formulas or Market Data code in this batch.

## Why this batch exists
Desktop 0.4 is an autonomous offline app and SQLite is authoritative for workspace JSON. Yet screenshot/image bytes live in Tauri WebView IndexedDB (`tradingResearchImages_v1/images`); Market Data has a separate IndexedDB (`marketMeta`, `marketTicks`, `execSets`). A SQLite workspace record alone cannot recover missing image bytes. Backup V2 already includes referenced image blobs and all Market Data, but a recovery snapshot is not continuous native authority.

## Narrow Batch 77 acceptance
Promote **referenced images only** to local native `AppLocalData/images/` with SQLite metadata: `id`, content hash, byte size, MIME/name and an explicit promotion generation. Image IDs are opaque: never use them directly as paths; content-address files with SHA-256 and validate both expected hash and bytes on every read. Keep staged/orphan files recoverable; do not GC until durable workspace references and backup/recovery journal have been respected. No cross-store partial 'success'.

- First migrate from the existing Image IndexedDB only after `trCoreFlush`, complete Backup V2 preflight, and fsync-confirmed native `.trbackup` rollback; verify every referenced image is readable and byte/hash-equal before promoting the image authority marker.
- Once promoted, read and write live image bytes through the native adapter (including attach, hydration, Backup V2, restore, manual GC and deletion). An explicit recovery protocol may reimport a certified Backup V2; no silent stale-IDB fallback. If a blob is missing/corrupt: lock dependent mutation, report failure and preserve rollback.
- Migration reruns must be idempotent after interruption and restart. Never reinterpret an empty native image store as a fresh migration when a marker exists.
- Native object files and SQLite catalog consistency must be checked on boot and after complete restore. Delete only unreachable IDs once the workspace revision has been durably committed.
- Existing Web image `IndexedDB` behavior remains unchanged; Desktop 0.4's workspace CAS, complete Backup V2 and Market Data IndexedDB remain valid.
- Test partial fs writes, bad IDs/path traversal, hash mismatch, duplicate IDs, empty/large blobs, missing native catalog/object, restart, repeated promotion, restore-before-and-after promotion, workspace rollback, reachability and Web isolation.

## Later batches (not implied by Batch 77)
- **Batch 78:** bounded/chunked native Market Data migration (`marketMeta` + `marketTicks` paired transaction; `execSets`), preserving tick precision and 2-million-observation limit without unbounded JSON bridge calls. Keep Web isolated.
- **Batch 79:** end-to-end Desktop portability and cold-recovery certification (workspace + images + Market Data, new installation and interrupted recovery) with one consolidated manual session.

## Release gates and manual budget
1. RED→GREEN native/JS verifier with real failure cases; exact-head prebuild, build, Windows native tests and installer.
2. **No installer given to the user until exact-head automated gates finish green.** Single offline Windows session, target no more than four user replies, preserving all current AppData and existing backups.
3. Draft PR until user approves controlled merge after live certification. No new user data/deletions/restore without an explicit test instruction and safe rollback.
