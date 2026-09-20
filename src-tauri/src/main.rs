#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn native_root(app: &AppHandle) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|e| format!("No se pudo resolver AppLocalData: {e}"))?;
    fs::create_dir_all(root.join("data"))
        .map_err(|e| format!("No se pudo crear data/: {e}"))?;
    fs::create_dir_all(root.join("backups"))
        .map_err(|e| format!("No se pudo crear backups/: {e}"))?;
    fs::create_dir_all(root.join("images"))
        .map_err(|e| format!("No se pudo crear images/: {e}"))?;
    Ok(root)
}

fn db_path(root: &Path) -> PathBuf {
    root.join("data").join("trading-research.sqlite3")
}

fn sha256_text(value: &str) -> String {
    let digest = Sha256::digest(value.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

fn open_db(root: &Path) -> Result<Connection, String> {
    let path = db_path(root);
    let conn = Connection::open(&path)
        .map_err(|e| format!("No se pudo abrir SQLite {}: {e}", path.display()))?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=FULL;
         CREATE TABLE IF NOT EXISTS workspace_shadow (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           payload TEXT NOT NULL,
           reason TEXT NOT NULL,
           updated_at TEXT NOT NULL,
           sha256 TEXT NOT NULL,
           bytes INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS native_meta (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL
         );",
    )
    .map_err(|e| format!("No se pudo preparar SQLite: {e}"))?;
    Ok(conn)
}

fn validate_workspace_json(payload: &str) -> Result<(), String> {
    let value: Value =
        serde_json::from_str(payload).map_err(|e| format!("Workspace JSON inválido: {e}"))?;
    if !value.is_object() || !value.get("tradingPlans").is_some_and(Value::is_array) {
        return Err("Workspace JSON no contiene tradingPlans.".into());
    }
    Ok(())
}

fn validate_backup_v2(payload: &str) -> Result<(), String> {
    let value: Value =
        serde_json::from_str(payload).map_err(|e| format!("Backup V2 JSON inválido: {e}"))?;
    if !value.is_object()
        || value.get("workspace").is_none()
        || value.get("manifest").is_none()
        || !value.get("images").is_some_and(Value::is_array)
        || value.get("marketData").is_none()
    {
        return Err("El payload no tiene la estructura completa de Backup V2.".into());
    }
    Ok(())
}

#[tauri::command]
fn desktop_mirror_workspace(
    app: AppHandle,
    payload: String,
    reason: String,
) -> Result<String, String> {
    validate_workspace_json(&payload)?;
    let root = native_root(&app)?;
    let mut conn = open_db(&root)?;
    let updated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let sha256 = sha256_text(&payload);
    let bytes = payload.len() as i64;
    let tx = conn
        .transaction()
        .map_err(|e| format!("No se pudo iniciar transacción SQLite: {e}"))?;
    tx.execute(
        "INSERT INTO workspace_shadow(id,payload,reason,updated_at,sha256,bytes)
         VALUES(1,?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET
           payload=excluded.payload,
           reason=excluded.reason,
           updated_at=excluded.updated_at,
           sha256=excluded.sha256,
           bytes=excluded.bytes",
        params![payload, reason, updated_at, sha256, bytes],
    )
    .map_err(|e| format!("No se pudo escribir el workspace en SQLite: {e}"))?;
    tx.commit()
        .map_err(|e| format!("No se pudo confirmar la transacción SQLite: {e}"))?;

    Ok(json!({
        "ok": true,
        "updatedAt": updated_at,
        "reason": reason,
        "sha256": sha256,
        "bytes": bytes,
        "dbPath": db_path(&root).to_string_lossy()
    })
    .to_string())
}

#[tauri::command]
fn desktop_read_workspace_shadow(app: AppHandle) -> Result<Option<String>, String> {
    let root = native_root(&app)?;
    let conn = open_db(&root)?;
    conn.query_row(
        "SELECT payload FROM workspace_shadow WHERE id=1",
        [],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| format!("No se pudo leer workspace_shadow: {e}"))
}

#[tauri::command]
fn desktop_storage_status(app: AppHandle) -> Result<String, String> {
    let root = native_root(&app)?;
    let conn = open_db(&root)?;
    let row = conn
        .query_row(
            "SELECT updated_at,reason,sha256,bytes FROM workspace_shadow WHERE id=1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                ))
            },
        )
        .optional()
        .map_err(|e| format!("No se pudo consultar workspace_shadow: {e}"))?;

    let backup_dir = root.join("backups");
    let backup_count = fs::read_dir(&backup_dir)
        .map_err(|e| format!("No se pudo leer backups/: {e}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|x| x.to_str()) == Some("trbackup"))
        .count();

    let shadow = row.map(|(updated_at, reason, sha256, bytes)| {
        json!({
            "updatedAt": updated_at,
            "reason": reason,
            "sha256": sha256,
            "bytes": bytes
        })
    });

    Ok(json!({
        "version": "0.2.0",
        "rootPath": root.to_string_lossy(),
        "dbPath": db_path(&root).to_string_lossy(),
        "backupPath": backup_dir.to_string_lossy(),
        "imagesPath": root.join("images").to_string_lossy(),
        "backupCount": backup_count,
        "shadow": shadow
    })
    .to_string())
}

#[tauri::command]
fn desktop_write_backup(app: AppHandle, payload: String) -> Result<String, String> {
    validate_backup_v2(&payload)?;
    let root = native_root(&app)?;
    let backup_dir = root.join("backups");
    let stamp = Utc::now().timestamp_millis();
    let file_name = format!("Trading-Research-backup-v2-{stamp}.trbackup");
    let final_path = backup_dir.join(file_name);
    let temp_path = backup_dir.join(format!(".backup-{stamp}.tmp"));

    {
        let mut file = File::create(&temp_path)
            .map_err(|e| format!("No se pudo crear backup temporal: {e}"))?;
        file.write_all(payload.as_bytes())
            .map_err(|e| format!("No se pudo escribir backup temporal: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("No se pudo sincronizar backup temporal: {e}"))?;
    }
    fs::rename(&temp_path, &final_path)
        .map_err(|e| format!("No se pudo publicar backup nativo: {e}"))?;

    Ok(json!({
        "ok": true,
        "path": final_path.to_string_lossy(),
        "bytes": payload.len(),
        "sha256": sha256_text(&payload)
    })
    .to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_mirror_workspace,
            desktop_read_workspace_shadow,
            desktop_storage_status,
            desktop_write_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trading Research Desktop");
}
