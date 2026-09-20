# Trading Research Desktop

## Channel model

Trading Research Web remains the development/testing channel.

Trading Research Desktop is the conservative local/offline channel. Desktop releases are promoted deliberately after the corresponding application behavior has already been validated on Web whenever that behavior is shared.

## Desktop 0.1 bootstrap

Desktop 0.1 is intentionally small in scope:

- Tauri v2 shell for Windows;
- the existing production frontend is built normally and copied into `desktop-dist/`;
- the external Supabase SDK tag is removed from the Desktop artifact;
- Tauri loads only packaged local frontend assets;
- GitHub Actions builds an NSIS Windows installer;
- the web deployment and Cloudflare pipeline remain unchanged.

The first runtime smoke is:

1. install on Windows 11;
2. open Trading Research;
3. create/edit local test data;
4. close and reopen the app;
5. disconnect Internet and verify the application still opens and the local workspace remains available.

## Persistence in 0.1

Desktop 0.1 still uses the application's existing IndexedDB/local storage engine inside WebView2. This is a bootstrap stage, not the final Desktop persistence architecture.

The next storage phase will move Desktop authority to SQLite + local files while leaving the Web channel on its current browser/Supabase architecture.

No Desktop release should be treated as authoritative for long-term data until the SQLite migration and backup/restore path are explicitly completed and tested.
