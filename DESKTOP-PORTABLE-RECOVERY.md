# Batch 79 · Desktop 0.7 — portable cold recovery

Base: certified Batch 78 / PR #92 merge `2cd3e73b5be8c7fa528e08b249b84b674f923fcd`.

## Objective
Certify that one complete Backup V2 can rebuild a fresh Desktop installation into the same native state:
- SQLite workspace authority;
- native content-addressed images;
- native Market Data (`marketMeta` + `marketTicks` + `execSets`);
- all authorities survive a full close/reopen and can rebuild a new Backup V2 with the same domain hashes.

No financial formula, Web storage model, import parser, plan semantics or Market Data calculation changes belong to this batch.

## Portable restore contract
A Desktop-only **portable restore** owns the recovery sequence. It must:
1. preflight the complete Backup V2 before mutation;
2. persist the selected source backup as an fsync-confirmed native `.trbackup` before restore starts;
3. persist a native restore journal containing source path/hash and monotonic phase;
4. block user writes while the journal is pending;
5. restore workspace through the SQLite authority path;
6. restore image bytes, then promote/verify native image authority;
7. restore Market Data, then promote/verify native Market Data in bounded chunks;
8. rebuild a complete Backup V2 through the final native adapters and require exact workspace/images/market manifest hashes;
9. clear the journal only after final deep verification.

An interrupted restore must be restart-resumable from the native source backup. No pending journal may silently fall back to stale IndexedDB or release the UI for writes.

## Safety
- Existing certified 0.6 installations keep normal in-place Backup V2 restore semantics.
- Portable restore requires either a fresh/empty target or an explicit native rollback of the current installation before replacement.
- Source and rollback files must stay inside AppLocalData/backups and be path-canonicalized.
- Marker/journal without its native source backup is fatal/recovery-required.
- Workspace/image/Market Data authority markers without their rows remain fatal as in Batches 76–78.
- Web behavior remains unchanged.

## Automated gates
- Pure JS behavior test of the portable restore state machine and interruption/resume phases.
- Rust tests using a fresh temporary AppLocalData root and a real SQLite file.
- Exact Backup V2 domain-hash parity after reconstructed native reads.
- restart/reopen verification, missing source backup, bad source hash, bad image hash, meta/tick mismatch, execSet orphan, interrupted phase, stale generation and duplicate resume.
- Windows packaging and normal Desktop 0.6 upgrade regression.

## Manual budget
One grouped offline session only. Do not ask the user to delete data. The current AppLocalData directory must first be preserved as a rollback/rename-safe source; final instructions should target <=4 user replies.

Known Batch 78 UX cleanup included here: **Verify Market Data** must explicitly report that authority is still IndexedDB before promotion instead of silently doing nothing.
