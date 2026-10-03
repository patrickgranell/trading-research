# Batch 76 · Desktop 0.4 — SQLite authority contract (DRAFT)

Base: certified `main` merge of PR #89, `85dc245a358034c30bd7588bf10b536a796d8a91`.

## Scope and exact meaning of authority
Desktop workspace JSON (Trading Plans, operations, settings, taxonomy and domain metadata) must hydrate **from SQLite** after explicit migration and each durable workspace commit must be confirmed **by SQLite** before it is reported successful. IndexedDB may remain a compatibility/read-only diagnostic mirror, but it must never silently override a promoted SQLite workspace. Web/Cloudflare and Supabase remain unchanged. Image blobs and Market Data stores currently have separate IndexedDB storage; their migration is **not** implied by promoting workspace JSON. They remain covered by the complete Backup V2/recovery journal. Do not advertise full all-data SQLite authority.

## Mandatory fail-closed invariants
1. Desktop-only routing, decided before the app's existing `trCoreBootstrap()`; never switch the web channel accidentally. No rewrite of financial formulas or taxonomy.
2. First upgrade from 0.3.1: read and validate the current authoritative IndexedDB workspace, flush pending writes, create and preflight a complete Backup V2 covering workspace, reachable images, marketMeta, marketTicks and execSets; persist an independent native rollback `.trbackup` with successful fsync before promoting SQLite. Existing SQLite `workspace_shadow` is **not** treated as authoritative merely because it exists.
3. Promote using a single SQLite transaction with a valid workspace payload, content hash, a monotonic revision and an explicit authority marker. Read it back and verify hash and revision; promotion must be idempotent across interruption/restart. Existing `recovery_snapshot` and native backups are not overwritten by promotion.
4. Promotion first fsync-publishes an independent sentinel at AppLocalData/sqlite-authority.marker (outside data/); if it exists and the SQLite authority row is missing/corrupt, boot fails closed (never reclassifies the profile as a fresh IndexedDB migration). A failed/interrupted first promotion may require deliberate recovery instead of automatic fallback. Once promoted, boot reads and verifies the SQLite authoritative record before exposing the UI. If SQLite is missing, corrupted, unavailable or has an unexpected revision, **block work and offer recovery**; never silently adopt stale IndexedDB or seed an empty workspace.
5. All normal workspace writes (including legacy `persist()`, explicit `trCorePersistNow`, queued/coalesced writes, imports and plan deletion) traverse one serialized SQLite durable boundary. Every successful `flush` must await SQLite transaction completion. A failed native commit must not be presented as saved, nor advanced by a lower-revision queued snapshot. Use revision/CAS and explicit fatal/error reporting.
6. DomainStore, Backup V2, independent image and Market Data stores, rollback/recovery and native backups remain usable. Restore updates authoritative workspace through the defined protocol or keeps a recoverable lock; do not allow an IndexedDB restore to be overwritten by a stale native authority on the next boot.
7. Integrity: compare canonical content/sha/revision on every authority read and in explicit diagnostics; display authority mode and last committed revision; preserve raw backup for recovery.
8. Upgrade is reversible by an **explicit**, confirmed recovery path using the pre-promotion native complete Backup V2. No automatic downgrade/fallback that could fork the data.
9. No edits to production `main` until exact-head Web CI, Cloudflare preview, Windows installer build and Windows 11 offline migration/restore smoke pass. Require same Git Tree at merge and postmerge verify.

## Automated evidence
- RED-before-GREEN verifier: no authority API/early boot gate/commit binding on 0.3.1.
- Rust tests for empty/malformed payload, monotonic revision, CAS rejection, transaction durability, hash mismatch, migration idempotence and corrupted authority read.
- JS tests for async boot order, preflight/backup-before-promotion, flush failure, coalescing order, restore/reopen, web no-op isolation and no IndexedDB fallback once promoted.
- Desktop offline verifier checks the actual desktop-dist boot artifact and no external assets.

## Manual smoke budget (at most one session, target 4 user replies)
1. Install Desktop 0.4 over certified 0.3.1 with Wi-Fi OFF; screen showing migrated count, migration backup, SQLite authority and original totals.
2. Create one temporary plan and one harmless edit; close/reopen OFFLINE; confirm persistence, revision and parity. Simulate fail-closed behavior using a **test profile**, never damage the user's working database.
3. Controlled recovery of a temporary change; close/reopen, verify 0 dataset errors and rollback file.
4. Final single consolidated PASS/FAIL report; no extra steps unless an actual defect is reproduced.

## Stop conditions
No promotion if Backup V2 preflight fails, if current 0.3.1 source differs unexpectedly from migration input, if native rollback is not physically confirmed, or if cross-store recovery is pending. An implementation that only mirrors SQLite or schedules it asynchronously after IndexedDB is NOT completion.
