#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod authority;
mod native_images;

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

/* Independent fsync-confirmed sentinel: a missing/corrupt SQLite file may never
 * be interpreted as a first installation once authority promotion began. */
fn authority_marker_path(root: &Path) -> PathBuf {
    root.join("sqlite-authority.marker")
}
fn ensure_authority_marker(root: &Path) -> Result<(),String> {
    let final_path=authority_marker_path(root);
    if final_path.exists() {
        let size=fs::metadata(&final_path).map_err(|e|format!("Marcador SQLite inaccesible: {e}"))?.len();
        if size==0 {return Err("Marcador de autoridad SQLite vacío: recuperación obligatoria.".into());}
        return Ok(());
    }
    let temp=root.join(".sqlite-authority.marker.tmp");
    {
        let mut file=File::create(&temp).map_err(|e|format!("Marcador de autoridad: {e}"))?;
        file.write_all(b"Trading Research Desktop 0.4: SQLITE WORKSPACE AUTHORITY; never use stale IndexedDB fallback\n")
            .map_err(|e|format!("Marcador de autoridad write: {e}"))?;
        file.sync_all().map_err(|e|format!("Marcador de autoridad fsync: {e}"))?;
    }
    fs::rename(&temp,&final_path).map_err(|e|format!("Marcador de autoridad publish: {e}"))?;
    Ok(())
}
fn guarded_authority_status(root:&Path,conn:&Connection)->Result<Value,String>{
    let status=authority::status(conn)?;
    if !status["active"].as_bool().unwrap_or(false) && authority_marker_path(root).exists() {
        return Err("Existe marcador de SQLite promovido, pero falta el registro de autoridad. No se permite migrar desde IndexedDB obsoleto. Recuperación obligatoria.".into());
    }
    if status["active"].as_bool().unwrap_or(false) {ensure_authority_marker(root)?;}
    Ok(status)
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
         CREATE TABLE IF NOT EXISTS recovery_snapshot (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           payload TEXT NOT NULL,
           source TEXT NOT NULL,
           created_at TEXT NOT NULL,
           sha256 TEXT NOT NULL,
           bytes INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS native_meta (
           key TEXT PRIMARY KEY,
           value TEXT NOT NULL
         );",
    )
    .map_err(|e| format!("No se pudo preparar SQLite: {e}"))?;
    authority::prepare_schema(&conn)?;
    native_images::prepare_schema(&conn)?;
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

fn safe_backup_label(label: Option<String>) -> String {
    let raw = label.unwrap_or_else(|| "backup-v2".into());
    let clean: String = raw
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect();
    let clean = clean.trim_matches('-');
    if clean.is_empty() {
        "backup-v2".into()
    } else {
        clean.chars().take(64).collect()
    }
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
fn desktop_store_recovery_snapshot(
    app: AppHandle,
    payload: String,
    source: String,
) -> Result<String, String> {
    validate_backup_v2(&payload)?;
    let root = native_root(&app)?;
    let mut conn = open_db(&root)?;
    let created_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let sha256 = sha256_text(&payload);
    let bytes = payload.len() as i64;
    let tx = conn
        .transaction()
        .map_err(|e| format!("No se pudo iniciar recovery transaction: {e}"))?;
    tx.execute(
        "INSERT INTO recovery_snapshot(id,payload,source,created_at,sha256,bytes)
         VALUES(1,?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET
           payload=excluded.payload,
           source=excluded.source,
           created_at=excluded.created_at,
           sha256=excluded.sha256,
           bytes=excluded.bytes",
        params![payload, source, created_at, sha256, bytes],
    )
    .map_err(|e| format!("No se pudo escribir recovery_snapshot: {e}"))?;
    tx.commit()
        .map_err(|e| format!("No se pudo confirmar recovery_snapshot: {e}"))?;

    Ok(json!({
        "ok": true,
        "createdAt": created_at,
        "source": source,
        "sha256": sha256,
        "bytes": bytes
    })
    .to_string())
}

#[tauri::command]
fn desktop_read_recovery_snapshot(app: AppHandle) -> Result<Option<String>, String> {
    let root = native_root(&app)?;
    let conn = open_db(&root)?;
    conn.query_row(
        "SELECT payload FROM recovery_snapshot WHERE id=1",
        [],
        |row| row.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| format!("No se pudo leer recovery_snapshot: {e}"))
}

#[tauri::command]
fn desktop_storage_status(app: AppHandle) -> Result<String, String> {
    let root = native_root(&app)?;
    let conn = open_db(&root)?;
    let shadow_row = conn
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
    let recovery_row = conn
        .query_row(
            "SELECT created_at,source,sha256,bytes FROM recovery_snapshot WHERE id=1",
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
        .map_err(|e| format!("No se pudo consultar recovery_snapshot: {e}"))?;

    let backup_dir = root.join("backups");
    let backup_count = fs::read_dir(&backup_dir)
        .map_err(|e| format!("No se pudo leer backups/: {e}"))?
        .filter_map(Result::ok)
        .filter(|entry| entry.path().extension().and_then(|x| x.to_str()) == Some("trbackup"))
        .count();

    let shadow = shadow_row.map(|(updated_at, reason, sha256, bytes)| {
        json!({
            "updatedAt": updated_at,
            "reason": reason,
            "sha256": sha256,
            "bytes": bytes
        })
    });
    let recovery = recovery_row.map(|(created_at, source, sha256, bytes)| {
        json!({
            "createdAt": created_at,
            "source": source,
            "sha256": sha256,
            "bytes": bytes
        })
    });

    Ok(json!({
        "version": "0.4.0",
        "rootPath": root.to_string_lossy(),
        "dbPath": db_path(&root).to_string_lossy(),
        "backupPath": backup_dir.to_string_lossy(),
        "imagesPath": root.join("images").to_string_lossy(),
        "backupCount": backup_count,
        "shadow": shadow,
        "recovery": recovery
    })
    .to_string())
}

#[tauri::command]
fn desktop_write_backup(
    app: AppHandle,
    payload: String,
    label: Option<String>,
) -> Result<String, String> {
    validate_backup_v2(&payload)?;
    let root = native_root(&app)?;
    let backup_dir = root.join("backups");
    let stamp = Utc::now().timestamp_millis();
    let safe_label = safe_backup_label(label);
    let file_name = format!("Trading-Research-{safe_label}-{stamp}.trbackup");
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
        "sha256": sha256_text(&payload),
        "label": safe_label
    })
    .to_string())
}

/* Batch 76: no authority is created from a shadow. Promotion requires a
 * separately fsync-confirmed, byte-present native Backup V2 for this workspace. */
#[tauri::command]
fn desktop_authority_status(app: AppHandle) -> Result<String,String> {
    let root=native_root(&app)?;
    guarded_authority_status(&root,&open_db(&root)?).map(|value| value.to_string())
}
#[tauri::command]
fn desktop_read_authoritative_workspace(app: AppHandle) -> Result<Option<String>,String> {
    let root=native_root(&app)?;
    authority::read(&open_db(&root)?).map(|value|value.map(|v|v.to_string()))
}
#[tauri::command]
fn desktop_promote_workspace_authority(
    app: AppHandle, payload:String, rollback_path:String
) -> Result<String,String> {
    let root=native_root(&app)?;
    authority::verify_rollback(&root,Path::new(&rollback_path),&payload)?;
    let mut conn=open_db(&root)?;
    // Sentinel precedes the promotion commit: interrupted promotion fails closed.
    guarded_authority_status(&root,&conn)?;
    ensure_authority_marker(&root)?;
    authority::promote(&mut conn,&payload,&rollback_path).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_commit_authoritative_workspace(
    app: AppHandle, payload:String, expected_revision:i64, reason:String
) -> Result<String,String> {
    let root=native_root(&app)?;
    let mut conn=open_db(&root)?;
    authority::commit(&mut conn,&payload,expected_revision,&reason).map(|v|v.to_string())
}

#[cfg(test)]
mod marker_tests {
    use super::*;
    #[test]
    fn missing_authority_after_marker_is_fatal() {
        let root=std::env::temp_dir().join(format!("tr-b76-marker-{}-{}",std::process::id(),Utc::now().timestamp_millis()));
        fs::create_dir_all(root.join("data")).unwrap();
        let conn=Connection::open_in_memory().unwrap();
        authority::prepare_schema(&conn).unwrap();
        assert_eq!(guarded_authority_status(&root,&conn).unwrap()["active"],false);
        ensure_authority_marker(&root).unwrap();
        assert!(guarded_authority_status(&root,&conn).is_err());
        let _=fs::remove_dir_all(root);
    }
}
/* Batch 77: read-only relative to the current Image IndexedDB authority.
 * These commands stage and verify immutable, hashed native objects; they DO
 * NOT promote image authority or alter image UX/backup/GC in Desktop 0.4.
 */
#[tauri::command]
fn desktop_stage_native_image(app:AppHandle,id:String,data:String,sha256:String,mime:String,name:String)->Result<String,String>{
    let root=native_root(&app)?;
    let mut conn=open_db(&root)?;
    native_images::stage(&mut conn,&root,&id,&data,&sha256,&mime,&name).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_read_staged_image(app:AppHandle,id:String)->Result<String,String>{
    let root=native_root(&app)?;
    let conn=open_db(&root)?;
    native_images::read(&conn,&root,&id).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_verify_staged_images(app:AppHandle,expected:String)->Result<String,String>{
    let pairs:Vec<(String,String)>=serde_json::from_str(&expected)
        .map_err(|e|format!("Inventario esperado inválido: {e}"))?;
    let root=native_root(&app)?;
    let conn=open_db(&root)?;
    native_images::verify(&conn,&root,&pairs).map(|v|v.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_stage_native_image,
            desktop_read_staged_image,
            desktop_verify_staged_images,
            desktop_authority_status,
            desktop_read_authoritative_workspace,
            desktop_promote_workspace_authority,
            desktop_commit_authoritative_workspace,
            desktop_mirror_workspace,
            desktop_read_workspace_shadow,
            desktop_store_recovery_snapshot,
            desktop_read_recovery_snapshot,
            desktop_storage_status,
            desktop_write_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trading Research Desktop");
}
