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
