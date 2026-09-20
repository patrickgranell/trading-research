# Trading Research Desktop

## Channel model

Trading Research Web remains the development/testing channel.

Trading Research Desktop is the conservative local/offline channel. Shared application behavior should normally mature on Web before entering a Desktop stable release. Desktop-specific filesystem/SQLite behavior is validated in Windows builds.

## Desktop 0.1 bootstrap — validated

Desktop 0.1 proved that the existing application can be installed on Windows 11, restore a Web Backup V2, persist data across full close/reopen, and open with Internet disconnected.

## Desktop 0.2 native storage foundation

Desktop 0.2 adds a native storage layer without yet changing the source of truth:

- IndexedDB remains the authoritative workspace store;
- every Desktop session maintains a SQLite shadow at the app's Windows LocalAppData directory;
- the Desktop panel can force a durable flush, mirror the workspace and compare SQLite byte-for-byte against the current workspace JSON;
- the existing certified Backup V2 builder is reused to write complete native `.trbackup` files directly into a local backups directory;
- native `data/`, `backups/` and `images/` directories are created under the app data root;
- the external Supabase SDK remains absent from the packaged Desktop artifact;
- Web/Cloudflare/Supabase behavior is unchanged.

SQLite is deliberately a shadow in 0.2. A mismatch cannot overwrite IndexedDB.

## Manual Desktop 0.2 smoke

1. install the 0.2 candidate on Windows 11;
2. open **Configuración → Datos y seguridad**;
3. verify the Desktop local-storage panel reports a SQLite path and status;
4. use **Sincronizar y verificar SQLite** and require exact parity;
5. use **Crear backup nativo** and confirm a Backup V2 path is reported;
6. close and reopen the application and re-check SQLite status;
7. repeat the parity check with Internet disconnected.

Only after this passes should a later batch consider promoting SQLite from shadow to authority.


## Desktop 0.2.1 corrective

The first 0.2.0 candidate exposed a UI recursion in the Desktop-only panel: its MutationObserver called paint() when the panel already existed, while paint() mutated the observed DOM again. This could lock the Configuration/Data view.

0.2.1 makes the observer insertion-only when the panel already exists. State/status repainting remains explicit and a permanent verifier rejects the self-triggering pattern.
