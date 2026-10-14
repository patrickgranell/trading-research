# Desktop 0.8.0 candidate — Web UI/UX PR1–PR4 consolidation

Date: 15 October 2026. Base: main at merge of PR #121 `141aec56f5faddc533489abaaaa6090b0acb2a57`.

## Implementation principle
Desktop runs the **same generated frontend** as Web: `npm run desktop:prepare` first builds `dist/index.html`, copies it to `desktop-dist/`, removes the CDN-only Supabase SDK, and applies **only** the native Desktop SQLite/image/Market Data/restore adapters. All Web PR1–PR4 layout, dashboard, multi-lot edit, Laboratorio, OOS, fullscreen evidence, configurable columns and PR4 reading views come from this shared compiled UI. Do NOT copy/reimplement four releases or touch financial rules.

## Candidate release scope
1. Bump *Desktop-only* Tauri/Cargo/desktop artifact markers and NSIS installer label to 0.8.0. Keep the global Web product V31.29.0 unchanged.
2. Strengthen offline/Desktop parity: compare the exact generated shared UI JS/CSS from Web vs Desktop; require markers for the four PR sets, verify no CDN resources or cloud SDK in Desktop, exact native adapter chain and release version agreement.
3. Reuse established Windows native tests: SQLite CAS/durable authority, images, Market Data, complete portable recovery, Backup V2 rollback and offline boot. Windows installer must be produced from the PR head before user smoke.
4. Preserve Desktop AppLocalData and all existing `0.7.0` user data without resetting, seeding or migrating schemas unnecessarily. A full certified Backup V2 is required as independent protection before any risky restore, never erase current data.

## Release gate and grouped Windows 11 manual smoke
- **D1** Upgrade over certified 0.7.0, disconnected from Internet: same TP and operation counts, no empty/stale SQLite fallback; Dashboard/Operaciones 2-lot and dates (PR1–2).
- **D2** Laboratorio: six tabs in one row, OOS last, Builder columns and images 1/2/3/4 (PR3).
- **D3** Trading Plans, Diario, Reflexiones/Hallazgos, Calidad and Reports/PDF (PR4), clear/dark theme.
- **D4** Offline full close/reopen, verify native SQLite, native image and Market Data totals, and a certified Backup V2 recovery in a **disposable test profile** or confirmed safe non-destructive recovery path. Never restore over current user data without certified native rollback.

Minimum user interventions, batch D1–D4 in one smoke. No merge/production installer announcement without user approval. Existing 0.7.0 installation must remain recoverable throughout.

## Checkpoints
- 00: branch initialized from web PR4 merge. Desktop is Tauri v2 + Windows NSIS, currently 0.7.0; Web frontend already common, so only packaging/integrity tests required.
- Pending: bump candidate version, add parity checks, Windows CI build, review binary artifact, user offline smoke and approval.
