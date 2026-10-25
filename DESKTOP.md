# Trading Research Desktop

## Channel model

Trading Research Web remains the development/testing channel.

Trading Research Desktop is the conservative local/offline channel. Shared application behavior should normally mature on Web before entering a Desktop stable release. Desktop-specific filesystem/SQLite behavior is validated in Windows builds.

## Desktop 0.1 bootstrap — validated

Desktop 0.1 proved that the existing application can be installed on Windows 11, restore a Web Backup V2, persist data across full close/reopen, and open with Internet disconnected.

## Desktop 0.2.1 native storage foundation — validated

Desktop 0.2.1 keeps IndexedDB authoritative and adds:
- a byte-parity SQLite workspace shadow;
- exact manual parity verification;
- native Backup V2 files under LocalAppData;
- offline operation after close/reopen.

The 0.2.0 candidate exposed a Desktop-only MutationObserver self-loop in the Data & Security panel. 0.2.1 corrected it and a permanent verifier rejects that pattern.

## Desktop 0.3 complete SQLite recovery

Desktop 0.3 keeps IndexedDB authoritative for normal operation, but SQLite becomes a complete recovery source.

A single `recovery_snapshot` record stores the full certified Backup V2 payload:
- workspace;
- every referenced image;
- Market Data metadata/ticks;
- execution sets;
- Backup V2 manifest and hashes.

The Desktop UI can:
1. build + preflight a certified Backup V2 payload;
2. store it atomically as the current SQLite recovery point;
3. read it back and run the normal Backup V2 preflight again;
4. restore it using the existing recoverable Backup V2 restore protocol.

Before any recovery restore, Desktop automatically creates a physical native Backup V2 file labelled `desktop-recovery-rollback` from the current state. If recovery fails, that rollback file remains outside SQLite.

SQLite is still not the day-to-day authority in 0.3. This batch proves complete read/recovery semantics before authority is promoted.

## Manual Desktop 0.3 smoke

1. install 0.3 over 0.2.1 and confirm existing Desktop data remains;
2. open **Configuración → Datos y seguridad**;
3. require **Sincronizar y verificar SQLite** to pass;
4. click **Crear punto de recuperación**;
5. click **Verificar recuperación** and require Backup V2 validation success;
6. create one harmless temporary change after the recovery point;
7. click **Restaurar desde SQLite** and confirm the temporary change disappears while the recovery-point data returns;
8. confirm a new rollback `.trbackup` was created automatically;
9. close/reopen and repeat recovery verification with Internet disconnected.

Only after this passes should a later batch consider promoting SQLite to the Desktop source of truth.

## Desktop 0.3.1 plan cleanup candidate

Shared Web/Desktop plan cards gain one-by-one and bulk selection/delete controls. Destructive deletion requires a certified Backup V2 first: native rollback in Desktop or saved browser download confirmation on Web. Plan-linked operations, import batches and opportunities are removed together. Market Data records tied to a selected plan block deletion until a specific cleanup exists; global instruments and shared library are preserved. At least one plan must remain. Durable state persistence, rollback and reachability-aware image GC follow the existing patterns. Manual smoke must cover empty plan, populated test plan, active plan switch, last-plan guard, bulk deletion, full backup restore, desktop offline behavior.

## Desktop 0.4.0 SQLite workspace authority — certified (Batch 76 / PR #90)

Desktop 0.4.0 has the native SQLite `workspace_authority` record as day-to-day
workspace source of truth, with SHA-256 and monotonic revision/CAS commits. The
first upgrade from IndexedDB requires a complete preflighted Backup V2 and a
physical fsync-confirmed native rollback before promotion. A separate
AppLocalData sentinel rejects silent migration from stale IndexedDB when an
already promoted SQLite authority is missing. The 0.4 Hotfix 3 offline smoke
validated migration, temporary fifth-plan persistence across restart, full
recovery of the original 4-plan / 154-operation dataset and zero audit errors.
Candidate and merged Git Tree match; Cloudflare production has the PR #90 version
active.

Image bytes and Market Data remain in distinct Tauri WebView IndexedDB stores:
the complete native Backup V2 can recover them, but SQLite workspace authority
must not be described as all-data native authority.

## Desktop 0.5.1 native images — certified (Batch 77 / PR #91)

Referenced image blobs are native, content-addressed by SHA-256 and catalogued in SQLite. Promotion is Backup-V2-first, fail-closed and restart durable. Manual certification verified generation 1 with 3 referenced images after full close/reopen.

## Desktop 0.6.0 native Market Data — certified (Batch 78 / PR #92)

`marketMeta`, `marketTicks` and `execSets` are native. Ticks cross the Tauri boundary in chunks of at most 25,000 rows; meta/ticks exact pairing and Grid references are transactionally enforced. Manual certification verified generation 1, 2 historical datasets, 2 Grid and 278,286 ticks after restart and a real historical read.

## Desktop 0.7 portable recovery — Batch 79 DRAFT

One complete Backup V2 is the portability boundary. A native source copy and rollback are fsync-confirmed before mutation; a SQLite journal blocks writes and records monotonic phases `prepared -> restored -> images-native -> market-native -> verified`. Restart resumes from the physical source backup. Final closure requires exact rebuilt Backup V2 domain hashes plus deep workspace/image/Market Data verification. See `DESKTOP-PORTABLE-RECOVERY.md`.

## Desktop 0.8.0 — UI/UX 0–8 parity upgrade candidate

This Windows release candidate incorporates the Web Lotes 0–8 after merge of PR #116, including:
- full theme light/dark and contextual navigation;
- task-based Lab, comparators and Research Grid keyboard access;
- contextual Backtesting/Live/SIM/Market Replay visibility;
- compact contextual-help icons and grouped weekday multi-select controls.

The Windows product identifier stays `app.tradingresearch.desktop`; the NSIS
installer upgrades the prior 0.7.0 installation in place. The app's existing
AppLocalData path is **not renamed, cleared or migrated** by this batch.
Web release `31.29.0` and Desktop release `0.8.0` are independent version tracks.

### Non-regression gates

`npm run desktop:prepare` builds the latest Web frontend, overlays all
previously certified native adapters, then runs native authority, backup,
portable recovery and Web UI parity gates. Windows Actions also run Rust
SQLite/native recovery tests and compile/upload an NSIS installer.

The previous backup-restore freeze is a critical regression. Keep the native
storage panel's idempotent observer, durable restore write-lock/journal,
rollback backup, and release-of-lock-only-after-verification unchanged.
Do not replace any recovered workspace with default or stale IndexedDB data.

### Short manual acceptance (user data preserved)

1. Before installing, **create and keep a complete Backup V2** and do not delete
   or rename the existing AppLocalData. Install 0.8.0 over 0.7.0.
2. Verify existing TP / operations / images / native Market Data and the Lote 8
   UI, then close the whole app and reopen **without Internet**. Confirm data
   and current state are unchanged.
3. In Configuración → Datos y seguridad, verify SQLite authority and the
   existing backup/recovery point. For restoration regression use **an isolated
   throwaway profile or a disposable test dataset with its own rollback**, never
   restore destructively against the sole original user dataset. Confirm that
   the app does not freeze and survives a full close/reopen.

The merge/release requires explicit user acceptance. This document does not
claim Windows installation or real-data restore has been manually certified.
