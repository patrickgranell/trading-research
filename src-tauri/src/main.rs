#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod authority;
mod native_images;
mod native_market;

use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom, Write};
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

fn portable_restore_marker_path(root:&Path)->PathBuf{root.join("portable-restore.marker")}
fn ensure_portable_restore_marker(root:&Path)->Result<(),String>{
    let final_path=portable_restore_marker_path(root);
    if final_path.exists(){
        if fs::metadata(&final_path).map_err(|e|format!("Marcador portable inaccesible: {e}"))?.len()==0{
            return Err("Marcador de restore portable vacío: recuperación obligatoria.".into());
        }
        return Ok(());
    }
    let temp=root.join(".portable-restore.marker.tmp");
    {
        let mut file=File::create(&temp).map_err(|e|format!("Marcador restore portable: {e}"))?;
        file.write_all(b"Trading Research Desktop 0.7: PORTABLE RESTORE PENDING; block writes until verified\n")
            .map_err(|e|format!("Marcador restore portable write: {e}"))?;
        file.sync_all().map_err(|e|format!("Marcador restore portable fsync: {e}"))?;
    }
    fs::rename(&temp,&final_path).map_err(|e|format!("Marcador restore portable publish: {e}"))?;
    Ok(())
}
fn portable_phase_rank(value:&str)->Option<usize>{
    ["prepared","restored","images-native","market-native","verified"].iter().position(|x|*x==value)
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
         );
         CREATE TABLE IF NOT EXISTS portable_restore_journal (
           id INTEGER PRIMARY KEY CHECK (id = 1),
           phase TEXT NOT NULL,
           source_path TEXT NOT NULL,
           source_sha256 TEXT NOT NULL,
           rollback_path TEXT NOT NULL,
           rollback_sha256 TEXT NOT NULL,
           started_at TEXT NOT NULL,
           updated_at TEXT NOT NULL
         );",
    )
    .map_err(|e| format!("No se pudo preparar SQLite: {e}"))?;
    authority::prepare_schema(&conn)?;
    native_images::prepare_schema(&conn)?;
    native_market::prepare_schema(&conn)?;
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
        "version": "0.7.0",
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


const DESKTOP_BACKUP_STREAM_CHUNK_MAX: usize = 512 * 1024;
const DESKTOP_BACKUP_STREAM_TOTAL_MAX: u64 = 1024 * 1024 * 1024;
fn backup_stream_session(value:&str)->Result<&str,String>{
    if value.is_empty()||value.len()>80||!value.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'-'||b==b'_'){
        return Err("ID de stream backup inválido.".into());
    }
    Ok(value)
}
fn backup_stream_path(root:&Path,session:&str)->Result<PathBuf,String>{
    backup_stream_session(session)?;
    Ok(root.join("backups").join(format!(".backup-stream-{session}.tmp")))
}
#[tauri::command]
fn desktop_backup_stream_begin(app:AppHandle,session_id:String)->Result<String,String>{
    let root=native_root(&app)?;let path=backup_stream_path(&root,&session_id)?;
    let file=fs::OpenOptions::new().write(true).create_new(true).open(&path)
      .map_err(|e|format!("No se pudo iniciar stream backup: {e}"))?;
    file.sync_all().map_err(|e|format!("fsync inicio stream backup: {e}"))?;
    Ok(json!({"ok":true,"sessionId":session_id,"bytes":0}).to_string())
}
#[tauri::command]
fn desktop_backup_stream_append(app:AppHandle,session_id:String,data_b64:String)->Result<String,String>{
    use base64::{engine::general_purpose::STANDARD,Engine as _};
    let root=native_root(&app)?;let path=backup_stream_path(&root,&session_id)?;
    if data_b64.len()>(DESKTOP_BACKUP_STREAM_CHUNK_MAX*4/3+16){return Err("Chunk de backup supera el límite IPC.".into());}
    let bytes=STANDARD.decode(data_b64).map_err(|e|format!("Chunk backup base64 inválido: {e}"))?;
    if bytes.is_empty()||bytes.len()>DESKTOP_BACKUP_STREAM_CHUNK_MAX{return Err("Chunk backup vacío o demasiado grande.".into());}
    let prior=fs::metadata(&path).map_err(|e|format!("Stream backup inexistente: {e}"))?.len();
    if prior+bytes.len() as u64>DESKTOP_BACKUP_STREAM_TOTAL_MAX{return Err("Backup supera 1 GiB; operación bloqueada.".into());}
    let mut file=fs::OpenOptions::new().append(true).open(&path).map_err(|e|format!("Apertura stream backup: {e}"))?;
    file.write_all(&bytes).map_err(|e|format!("Escritura stream backup: {e}"))?;
    Ok(json!({"ok":true,"sessionId":session_id,"bytes":prior+bytes.len() as u64}).to_string())
}
#[tauri::command]
fn desktop_backup_stream_finalize(app:AppHandle,session_id:String,label:Option<String>)->Result<String,String>{
    let root=native_root(&app)?;let temp=backup_stream_path(&root,&session_id)?;
    {
        let file=fs::OpenOptions::new().read(true).write(true).open(&temp).map_err(|e|format!("Stream backup no disponible: {e}"))?;
        file.sync_all().map_err(|e|format!("fsync final stream backup: {e}"))?;
    }
    let mut payload=String::new();
    File::open(&temp).and_then(|mut f|f.read_to_string(&mut payload))
      .map_err(|e|format!("Lectura final stream backup: {e}"))?;
    validate_backup_v2(&payload)?;
    let safe_label=safe_backup_label(label);
    let stamp=Utc::now().timestamp_millis();
    let final_path=root.join("backups").join(format!("Trading-Research-{safe_label}-{stamp}.trbackup"));
    fs::rename(&temp,&final_path).map_err(|e|format!("Publicación stream backup: {e}"))?;
    Ok(json!({"ok":true,"path":final_path.to_string_lossy(),"bytes":payload.len(),"sha256":sha256_text(&payload),"label":safe_label}).to_string())
}
#[tauri::command]
fn desktop_backup_stream_abort(app:AppHandle,session_id:String)->Result<String,String>{
    let root=native_root(&app)?;let path=backup_stream_path(&root,&session_id)?;
    if path.exists(){fs::remove_file(&path).map_err(|e|format!("Abort stream backup: {e}"))?;}
    Ok(json!({"ok":true,"sessionId":session_id,"aborted":true}).to_string())
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

fn canonical_native_backup_path(root:&Path,backup_path:&str)->Result<PathBuf,String>{
    let backup_root=root.join("backups").canonicalize().map_err(|e|format!("Directorio de backups nativos: {e}"))?;
    let candidate=PathBuf::from(backup_path).canonicalize().map_err(|e|format!("Backup nativo no existe: {e}"))?;
    if candidate.parent()!=Some(backup_root.as_path()) || candidate.extension().and_then(|x|x.to_str())!=Some("trbackup"){
        return Err("El backup no pertenece al directorio nativo backups/.".into());
    }
    Ok(candidate)
}
fn validated_native_backup(root:&Path,rollback_path:&str)->Result<(String,String),String>{
    let candidate=canonical_native_backup_path(root,rollback_path)?;
    // Read exactly once: the payload we validate must be the same bytes whose
    // hash is bound into staging/promotion. A second filesystem read creates
    // an unnecessary TOCTOU window.
    let payload=fs::read_to_string(&candidate).map_err(|e|format!("Lectura rollback de staging: {e}"))?;
    validate_backup_v2(&payload)?;
    let payload_sha=sha256_text(&payload);
    Ok((payload,payload_sha))
}
fn backup_image_inventory(payload:&str)->Result<Vec<(String,String)>,String>{
    let value:Value=serde_json::from_str(payload).map_err(|e|format!("Rollback JSON inválido: {e}"))?;
    let images=value.get("images").and_then(Value::as_array).ok_or("Rollback sin imágenes.")?;
    let mut out=Vec::with_capacity(images.len());
    for image in images{
        let id=image.get("id").and_then(Value::as_str).ok_or("Imagen de rollback sin id.")?;
        let sha=image.get("sha256").and_then(Value::as_str).ok_or("Imagen de rollback sin SHA-256.")?;
        out.push((id.to_owned(),sha.to_owned()));
    }
    out.sort();
    Ok(out)
}
#[tauri::command]
fn desktop_finalize_native_image_staging(app:AppHandle,expected:String,rollback_path:String)->Result<String,String>{
    let mut pairs:Vec<(String,String)>=serde_json::from_str(&expected)
        .map_err(|e|format!("Inventario esperado inválido: {e}"))?;
    pairs.sort();
    let root=native_root(&app)?;
    let (backup_payload,backup_sha)=validated_native_backup(&root,&rollback_path)?;
    if backup_image_inventory(&backup_payload)?!=pairs{
        return Err("El rollback Backup V2 no contiene exactamente el inventario de imágenes staged.".into());
    }
    let mut conn=open_db(&root)?;
    native_images::finalize(&mut conn,&root,&pairs,&rollback_path,&backup_sha).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_native_image_staging_status(app:AppHandle)->Result<String,String>{
    let root=native_root(&app)?;
    let conn=open_db(&root)?;
    native_images::status(&conn,&root).map(|v|v.to_string())
}

#[tauri::command]
fn desktop_native_image_authority_status(app:AppHandle,deep:Option<bool>)->Result<String,String>{
    let root=native_root(&app)?;
    let conn=open_db(&root)?;
    native_images::authority_status(&conn,&root,deep.unwrap_or(false)).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_promote_native_image_authority(app:AppHandle,expected:String,rollback_path:String)->Result<String,String>{
    let mut pairs:Vec<(String,String)>=serde_json::from_str(&expected)
        .map_err(|e|format!("Inventario esperado inválido: {e}"))?;
    pairs.sort();
    let root=native_root(&app)?;
    let (backup_payload,backup_sha)=validated_native_backup(&root,&rollback_path)?;
    if backup_image_inventory(&backup_payload)?!=pairs{
        return Err("El rollback Backup V2 no coincide con el inventario que se intenta promover.".into());
    }
    let mut conn=open_db(&root)?;
    native_images::promote(&mut conn,&root,&pairs,&rollback_path,&backup_sha).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_native_image_batch(
    app:AppHandle,puts:String,deletes:String,expected_generation:i64,reason:String
)->Result<String,String>{
    let put_values:Vec<Value>=serde_json::from_str(&puts).map_err(|e|format!("Puts imágenes inválidos: {e}"))?;
    let delete_ids:Vec<String>=serde_json::from_str(&deletes).map_err(|e|format!("Deletes imágenes inválidos: {e}"))?;
    let root=native_root(&app)?;
    let mut conn=open_db(&root)?;
    native_images::batch_commit(&mut conn,&root,&put_values,&delete_ids,expected_generation,&reason).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_read_native_image(app:AppHandle,id:String)->Result<String,String>{
    let root=native_root(&app)?;
    let conn=open_db(&root)?;
    native_images::read_active(&conn,&root,&id).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_list_native_images(app:AppHandle)->Result<String,String>{
    let root=native_root(&app)?;
    let conn=open_db(&root)?;
    if !native_images::authority_status(&conn,&root,false)?.get("active").and_then(Value::as_bool).unwrap_or(false){
        return Err("Autoridad de imágenes nativas no activa.".into());
    }
    native_images::list(&conn).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_gc_native_image_objects(app:AppHandle)->Result<String,String>{
    let root=native_root(&app)?;
    let conn=open_db(&root)?;
    native_images::gc_objects(&conn,&root).map(|v|v.to_string())
}


/* Batch 78 · Market Data native staging only. These commands never switch
 * authority; IndexedDB remains live until the bounded migration is certified. */
#[tauri::command]
fn desktop_market_begin_staging(app:AppHandle,rollback_path:String)->Result<String,String>{
    let root=native_root(&app)?;
    let (_payload,backup_sha)=validated_native_backup(&root,&rollback_path)?;
    let mut conn=open_db(&root)?;
    native_market::begin_stage(&mut conn,&rollback_path,&backup_sha).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_stage_meta(app:AppHandle,generation:i64,id:String,payload:String,sha256:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::stage_meta(&mut conn,generation,&id,&payload,&sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_stage_exec(app:AppHandle,generation:i64,id:String,payload:String,sha256:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::stage_exec(&mut conn,generation,&id,&payload,&sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_stage_tick_chunk(app:AppHandle,generation:i64,dataset_id:String,chunk_index:i64,payload:String,sha256:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::stage_tick_chunk(&mut conn,generation,&dataset_id,chunk_index,&payload,&sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_finalize_dataset(app:AppHandle,generation:i64,dataset_id:String,chunk_count:i64,row_count:i64,aggregate_sha256:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::finalize_dataset(&mut conn,generation,&dataset_id,chunk_count,row_count,&aggregate_sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_verify_staging(app:AppHandle,generation:i64,inventory:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::verify_stage(&mut conn,generation,&inventory).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_read_staged_chunk(app:AppHandle,generation:i64,dataset_id:String,chunk_index:i64)->Result<String,String>{
    let root=native_root(&app)?;let conn=open_db(&root)?;
    native_market::read_chunk(&conn,generation,&dataset_id,chunk_index).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_staging_status(app:AppHandle)->Result<String,String>{
    let root=native_root(&app)?;let conn=open_db(&root)?;
    native_market::status(&conn).map(|v|v.to_string())
}

#[tauri::command]
fn desktop_market_authority_status(app:AppHandle,deep:Option<bool>)->Result<String,String>{
    let root=native_root(&app)?;let conn=open_db(&root)?;
    native_market::authority_status(&conn,&root,deep.unwrap_or(false)).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_promote_authority(app:AppHandle,generation:i64,rollback_path:String)->Result<String,String>{
    let root=native_root(&app)?;
    let (_payload,sha)=validated_native_backup(&root,&rollback_path)?;
    let mut conn=open_db(&root)?;
    native_market::promote(&mut conn,&root,generation,&rollback_path,&sha).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_list_records(app:AppHandle,store:String)->Result<String,String>{
    let root=native_root(&app)?;let conn=open_db(&root)?;
    native_market::list_records(&conn,&store).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_get_record(app:AppHandle,store:String,id:String)->Result<Option<String>,String>{
    let root=native_root(&app)?;let conn=open_db(&root)?;
    native_market::get_record(&conn,&store,&id).map(|v|v.map(|x|x.to_string()))
}
#[tauri::command]
fn desktop_market_list_catalogs(app:AppHandle)->Result<String,String>{
    let root=native_root(&app)?;let conn=open_db(&root)?;
    native_market::list_catalogs(&conn).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_read_active_chunk(app:AppHandle,dataset_id:String,chunk_index:i64)->Result<String,String>{
    let root=native_root(&app)?;let conn=open_db(&root)?;
    native_market::read_active_chunk(&conn,&dataset_id,chunk_index).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_begin_live_op(app:AppHandle,op_id:String,expected_generation:i64,reason:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::begin_live_op(&mut conn,&op_id,expected_generation,&reason).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_stage_live_record(app:AppHandle,op_id:String,store:String,id:String,payload:String,sha256:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::stage_live_record(&mut conn,&op_id,&store,&id,&payload,&sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_stage_live_delete(app:AppHandle,op_id:String,store:String,id:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::stage_live_delete(&mut conn,&op_id,&store,&id).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_stage_live_tick_chunk(app:AppHandle,op_id:String,dataset_id:String,chunk_index:i64,payload:String,sha256:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::stage_live_tick_chunk(&mut conn,&op_id,&dataset_id,chunk_index,&payload,&sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_finalize_live_tick(app:AppHandle,op_id:String,dataset_id:String,chunk_count:i64,row_count:i64,aggregate_sha256:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::finalize_live_tick(&mut conn,&op_id,&dataset_id,chunk_count,row_count,&aggregate_sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_commit_live_op(app:AppHandle,op_id:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::commit_live_op(&mut conn,&op_id).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_market_abort_live_op(app:AppHandle,op_id:String)->Result<String,String>{
    let root=native_root(&app)?;let mut conn=open_db(&root)?;
    native_market::abort_live_op(&mut conn,&op_id).map(|v|v.to_string())
}


fn portable_restore_row(conn:&Connection)->Result<Option<(String,String,String,String,String,String)>,String>{
    conn.query_row(
      "SELECT phase,source_path,source_sha256,rollback_path,rollback_sha256,updated_at FROM portable_restore_journal WHERE id=1",
      [],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?))
    ).optional().map_err(|e|format!("Lectura journal restore portable: {e}"))
}
fn portable_restore_begin_root(root:&Path,source_path:&str,source_sha256:&str,rollback_path:&str,rollback_sha256:&str)->Result<Value,String>{
    let (_,source_sha)=validated_native_backup(root,source_path)?;
    let (_,rollback_sha)=validated_native_backup(root,rollback_path)?;
    if source_sha!=source_sha256||rollback_sha!=rollback_sha256{return Err("Hash de backup source/rollback no coincide con el journal portable.".into());}
    let mut conn=open_db(root)?;
    if let Some((phase,sp,ss,rp,rs,updated))=portable_restore_row(&conn)?{
        if sp!=source_path||ss!=source_sha256||rp!=rollback_path||rs!=rollback_sha256{
            return Err("Ya existe un restore portable pendiente ligado a otros backups.".into());
        }
        ensure_portable_restore_marker(root)?;
        return Ok(json!({"ok":true,"active":true,"resumed":true,"phase":phase,"sourcePath":sp,"sourceSha256":ss,"rollbackPath":rp,"rollbackSha256":rs,"updatedAt":updated}));
    }
    if portable_restore_marker_path(root).exists(){return Err("Existe marcador de restore portable sin journal SQLite. Recuperación obligatoria.".into());}
    ensure_portable_restore_marker(root)?;
    let now=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Inicio journal restore portable: {e}"))?;
    tx.execute("INSERT INTO portable_restore_journal(id,phase,source_path,source_sha256,rollback_path,rollback_sha256,started_at,updated_at) VALUES(1,'prepared',?1,?2,?3,?4,?5,?5)",
      params![source_path,source_sha256,rollback_path,rollback_sha256,now]).map_err(|e|format!("Escritura journal restore portable: {e}"))?;
    tx.commit().map_err(|e|format!("Commit journal restore portable: {e}"))?;
    Ok(json!({"ok":true,"active":true,"resumed":false,"phase":"prepared","sourcePath":source_path,"sourceSha256":source_sha256,"rollbackPath":rollback_path,"rollbackSha256":rollback_sha256,"updatedAt":now}))
}
fn portable_restore_status_root(root:&Path)->Result<Value,String>{
    let conn=open_db(root)?;
    let row=portable_restore_row(&conn)?;
    if row.is_none(){
        if portable_restore_marker_path(root).exists(){return Err("Marcador de restore portable presente sin journal SQLite. Recuperación obligatoria.".into());}
        return Ok(json!({"ok":true,"active":false}));
    }
    let (phase,sp,ss,rp,rs,updated)=row.unwrap();
    portable_phase_rank(&phase).ok_or("Fase de restore portable desconocida.")?;
    ensure_portable_restore_marker(root)?;
    let (_,source_sha)=validated_native_backup(root,&sp)?;
    let (_,rollback_sha)=validated_native_backup(root,&rp)?;
    if source_sha!=ss||rollback_sha!=rs{return Err("Backup source/rollback del restore portable cambió desde el journal.".into());}
    Ok(json!({"ok":true,"active":true,"phase":phase,"sourcePath":sp,"sourceSha256":ss,"rollbackPath":rp,"rollbackSha256":rs,"updatedAt":updated}))
}
fn portable_restore_advance_root(root:&Path,expected_phase:&str,next_phase:&str)->Result<Value,String>{
    let expected=portable_phase_rank(expected_phase).ok_or("Fase esperada portable inválida.")?;
    let next=portable_phase_rank(next_phase).ok_or("Fase siguiente portable inválida.")?;
    if next!=expected+1{return Err("Transición de fase portable no secuencial.".into());}
    let mut conn=open_db(root)?;
    let row=portable_restore_row(&conn)?.ok_or("No existe restore portable pendiente.")?;
    if row.0!=expected_phase{return Err(format!("Fase portable obsoleta: esperada {expected_phase}, real {}.",row.0));}
    let now=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Inicio avance restore portable: {e}"))?;
    let changed=tx.execute("UPDATE portable_restore_journal SET phase=?1,updated_at=?2 WHERE id=1 AND phase=?3",params![next_phase,now,expected_phase])
      .map_err(|e|format!("Avance restore portable: {e}"))?;
    if changed!=1{return Err("CAS de fase restore portable rechazado.".into());}
    tx.commit().map_err(|e|format!("Commit fase restore portable: {e}"))?;
    Ok(json!({"ok":true,"phase":next_phase,"updatedAt":now}))
}
fn portable_restore_clear_root(root:&Path)->Result<Value,String>{
    let mut conn=open_db(root)?;
    let row=portable_restore_row(&conn)?.ok_or("No existe restore portable pendiente.")?;
    if row.0!="verified"{return Err("Restore portable no puede cerrarse antes de verified.".into());}
    // Remove the marker first. If the process dies before deleting the SQLite
    // row, status sees the verified row and recreates the marker, so cleanup is
    // resumable. The inverse order could leave a fatal orphan marker.
    let marker=portable_restore_marker_path(root);
    if marker.exists(){fs::remove_file(&marker).map_err(|e|format!("Borrado marcador restore portable: {e}"))?;}
    let tx=conn.transaction().map_err(|e|format!("Inicio cierre restore portable: {e}"))?;
    tx.execute("DELETE FROM portable_restore_journal WHERE id=1",[]).map_err(|e|format!("Borrado journal restore portable: {e}"))?;
    tx.commit().map_err(|e|format!("Commit cierre restore portable: {e}"))?;
    Ok(json!({"ok":true,"active":false}))
}
#[tauri::command]
fn desktop_portable_restore_begin(app:AppHandle,source_path:String,source_sha256:String,rollback_path:String,rollback_sha256:String)->Result<String,String>{
    let root=native_root(&app)?;
    portable_restore_begin_root(&root,&source_path,&source_sha256,&rollback_path,&rollback_sha256).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_portable_restore_status(app:AppHandle)->Result<String,String>{
    let root=native_root(&app)?;
    portable_restore_status_root(&root).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_portable_restore_advance(app:AppHandle,expected_phase:String,next_phase:String)->Result<String,String>{
    let root=native_root(&app)?;
    portable_restore_advance_root(&root,&expected_phase,&next_phase).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_portable_restore_clear(app:AppHandle)->Result<String,String>{
    let root=native_root(&app)?;
    portable_restore_clear_root(&root).map(|v|v.to_string())
}
#[tauri::command]
fn desktop_read_native_backup_chunk(app:AppHandle,path:String,offset:u64,max_bytes:usize)->Result<String,String>{
    use base64::{engine::general_purpose::STANDARD,Engine as _};
    let root=native_root(&app)?;let file_path=canonical_native_backup_path(&root,&path)?;
    if max_bytes==0||max_bytes>DESKTOP_BACKUP_STREAM_CHUNK_MAX{return Err("Lectura de backup solicita un chunk fuera de límites.".into());}
    let size=fs::metadata(&file_path).map_err(|e|format!("Metadata backup portable: {e}"))?.len();
    if offset>size{return Err("Offset de backup fuera de rango.".into());}
    let mut file=File::open(&file_path).map_err(|e|format!("Apertura backup portable: {e}"))?;
    file.seek(SeekFrom::Start(offset)).map_err(|e|format!("Seek backup portable: {e}"))?;
    let mut buf=vec![0u8;max_bytes.min((size-offset) as usize)];
    let read=file.read(&mut buf).map_err(|e|format!("Lectura chunk backup portable: {e}"))?;
    buf.truncate(read);
    Ok(json!({"ok":true,"offset":offset,"bytes":read,"totalBytes":size,"eof":offset+read as u64>=size,"dataB64":STANDARD.encode(buf)}).to_string())
}

#[cfg(test)]
mod portable_restore_tests{
    use super::*;
    fn payload()->String{
        json!({"format":"trading-research-backup","schema":2,"manifest":{},"workspace":{"tradingPlans":[]},"images":[],"marketData":{"marketMeta":[],"marketTicks":[],"execSets":[]}}).to_string()
    }
    fn setup()->(PathBuf,String,String,String,String){
        let root=std::env::temp_dir().join(format!("tr-b79-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(root.join("data")).unwrap();fs::create_dir_all(root.join("backups")).unwrap();fs::create_dir_all(root.join("images")).unwrap();
        let source=root.join("backups/source.trbackup");let rollback=root.join("backups/rollback.trbackup");
        let body=payload();fs::write(&source,&body).unwrap();fs::write(&rollback,&body).unwrap();
        let sha=sha256_text(&body);
        (root,source.to_string_lossy().to_string(),sha.clone(),rollback.to_string_lossy().to_string(),sha)
    }
    #[test]
    fn portable_journal_survives_reopen_and_clears_only_after_verified(){
        let(root,source,source_sha,rollback,rollback_sha)=setup();
        let begun=portable_restore_begin_root(&root,&source,&source_sha,&rollback,&rollback_sha).unwrap();
        assert_eq!(begun["phase"],"prepared");assert!(portable_restore_marker_path(&root).exists());
        drop(open_db(&root).unwrap());
        assert_eq!(portable_restore_status_root(&root).unwrap()["phase"],"prepared");
        assert!(portable_restore_advance_root(&root,"prepared","images-native").is_err());
        for (from,to) in [("prepared","restored"),("restored","images-native"),("images-native","market-native"),("market-native","verified")]{
            assert_eq!(portable_restore_advance_root(&root,from,to).unwrap()["phase"],to);
        }
        assert_eq!(portable_restore_status_root(&root).unwrap()["phase"],"verified");
        portable_restore_clear_root(&root).unwrap();
        assert_eq!(portable_restore_status_root(&root).unwrap()["active"],false);
        assert!(!portable_restore_marker_path(&root).exists());
        let _=fs::remove_dir_all(root);
    }
    #[test]
    fn portable_journal_fails_closed_when_source_disappears(){
        let(root,source,source_sha,rollback,rollback_sha)=setup();
        portable_restore_begin_root(&root,&source,&source_sha,&rollback,&rollback_sha).unwrap();
        fs::remove_file(&source).unwrap();
        assert!(portable_restore_status_root(&root).is_err());
        assert!(portable_restore_marker_path(&root).exists());
        let conn=open_db(&root).unwrap();assert!(portable_restore_row(&conn).unwrap().is_some());
        let _=fs::remove_dir_all(root);
    }
    #[test]
    fn portable_marker_without_journal_is_fatal(){
        let(root,_source,_sha,_rollback,_rsha)=setup();
        ensure_portable_restore_marker(&root).unwrap();
        assert!(portable_restore_status_root(&root).is_err());
        let _=fs::remove_dir_all(root);
    }
    #[test]
    fn portable_begin_is_idempotent_only_for_same_physical_backups(){
        let(root,source,source_sha,rollback,rollback_sha)=setup();
        portable_restore_begin_root(&root,&source,&source_sha,&rollback,&rollback_sha).unwrap();
        assert_eq!(portable_restore_begin_root(&root,&source,&source_sha,&rollback,&rollback_sha).unwrap()["resumed"],true);
        let other=root.join("backups/other.trbackup");fs::write(&other,payload()).unwrap();
        assert!(portable_restore_begin_root(&root,&other.to_string_lossy(),&source_sha,&rollback,&rollback_sha).is_err());
        let _=fs::remove_dir_all(root);
    }
    #[test]
    fn fresh_root_reconstructs_all_native_authorities_and_survives_reopen(){
        use base64::{engine::general_purpose::STANDARD,Engine as _};
        let root=std::env::temp_dir().join(format!("tr-b79-cold-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(root.join("data")).unwrap();fs::create_dir_all(root.join("backups")).unwrap();fs::create_dir_all(root.join("images")).unwrap();

        let workspace=json!({
          "tradingPlans":[{"id":"TP1"}],"operations":[{"id":"OP1"}],"opportunities":[],"importBatches":[],
          "settings":{"instruments":[]}
        });
        let image_bytes=b"portable-image";
        let image_data=STANDARD.encode(image_bytes);
        let image_sha=sha256_text("portable-image");
        let meta=json!({"id":"MD1","instrument":"CL"});let meta_text=meta.to_string();let meta_sha=sha256_text(&meta_text);
        let exec=json!({"id":"EX1","marketDatasetId":"MD1"});let exec_text=exec.to_string();let exec_sha=sha256_text(&exec_text);
        let ticks=json!([[1,0,1,1,1,1]]).to_string();let tick_sha=sha256_text(&ticks);
        let aggregate=sha256_text(&format!("0:1:{tick_sha}\n"));
        let backup=json!({
          "format":"trading-research-backup","schema":2,"manifest":{},
          "workspace":workspace,
          "images":[{"id":"IMG1","data":image_data,"sha256":image_sha,"type":"image/png","name":"proof.png"}],
          "marketData":{"marketMeta":[meta],"marketTicks":[{"id":"MD1","ticks":[[1,0,1,1,1,1]]}],"execSets":[exec]}
        }).to_string();
        let source=root.join("backups/portable-source.trbackup");fs::write(&source,&backup).unwrap();
        let source_path=source.to_string_lossy().to_string();
        let (_,backup_sha)=validated_native_backup(&root,&source_path).unwrap();
        let workspace_text=serde_json::from_str::<Value>(&backup).unwrap()["workspace"].to_string();

        {
            let mut conn=open_db(&root).unwrap();
            authority::verify_rollback(&root,&source,&workspace_text).unwrap();
            ensure_authority_marker(&root).unwrap();
            authority::promote(&mut conn,&workspace_text,&source_path).unwrap();

            let expected_images=vec![("IMG1".to_string(),image_sha.clone())];
            assert_eq!(backup_image_inventory(&backup).unwrap(),expected_images);
            native_images::stage(&mut conn,&root,"IMG1",&STANDARD.encode(image_bytes),&image_sha,"image/png","proof.png").unwrap();
            native_images::finalize(&mut conn,&root,&expected_images,&source_path,&backup_sha).unwrap();
            native_images::promote(&mut conn,&root,&expected_images,&source_path,&backup_sha).unwrap();

            let generation=native_market::begin_stage(&mut conn,&source_path,&backup_sha).unwrap()["generation"].as_i64().unwrap();
            native_market::stage_meta(&mut conn,generation,"MD1",&meta_text,&meta_sha).unwrap();
            native_market::stage_exec(&mut conn,generation,"EX1",&exec_text,&exec_sha).unwrap();
            native_market::stage_tick_chunk(&mut conn,generation,"MD1",0,&ticks,&tick_sha).unwrap();
            native_market::finalize_dataset(&mut conn,generation,"MD1",1,1,&aggregate).unwrap();
            let inventory=json!({
              "meta":[{"id":"MD1","sha256":meta_sha}],
              "exec":[{"id":"EX1","sha256":exec_sha}],
              "ticks":[{"id":"MD1","rowCount":1,"chunkCount":1,"aggregateSha256":aggregate}]
            }).to_string();
            native_market::verify_stage(&mut conn,generation,&inventory).unwrap();
            native_market::promote(&mut conn,&root,generation,&source_path,&backup_sha).unwrap();
        }

        {
            let conn=open_db(&root).unwrap();
            let ws=authority::read(&conn).unwrap().unwrap();
            assert_eq!(serde_json::from_str::<Value>(ws["payload"].as_str().unwrap()).unwrap(),workspace);
            let images=native_images::authority_status(&conn,&root,true).unwrap();
            assert_eq!(images["active"],true);assert_eq!(images["catalogRecords"],1);
            let image=native_images::read_active(&conn,&root,"IMG1").unwrap();
            assert_eq!(image["sha256"],image_sha);
            let market=native_market::authority_status(&conn,&root,true).unwrap();
            assert_eq!(market["active"],true);assert_eq!(market["datasets"],1);assert_eq!(market["execSets"],1);assert_eq!(market["ticks"],1);
            assert!(native_market::get_record(&conn,"marketMeta","MD1").unwrap().is_some());
            assert_eq!(native_market::read_active_chunk(&conn,"MD1",0).unwrap()["rowCount"],1);
        }
        let _=fs::remove_dir_all(root);
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            desktop_market_begin_staging,
            desktop_market_stage_meta,
            desktop_market_stage_exec,
            desktop_market_stage_tick_chunk,
            desktop_market_finalize_dataset,
            desktop_market_verify_staging,
            desktop_market_read_staged_chunk,
            desktop_market_staging_status,
            desktop_market_authority_status,
            desktop_market_promote_authority,
            desktop_market_list_records,
            desktop_market_get_record,
            desktop_market_list_catalogs,
            desktop_market_read_active_chunk,
            desktop_market_begin_live_op,
            desktop_market_stage_live_record,
            desktop_market_stage_live_delete,
            desktop_market_stage_live_tick_chunk,
            desktop_market_finalize_live_tick,
            desktop_market_commit_live_op,
            desktop_market_abort_live_op,
            desktop_portable_restore_begin,
            desktop_portable_restore_status,
            desktop_portable_restore_advance,
            desktop_portable_restore_clear,
            desktop_read_native_backup_chunk,
            desktop_stage_native_image,
            desktop_read_staged_image,
            desktop_verify_staged_images,
            desktop_finalize_native_image_staging,
            desktop_native_image_staging_status,
            desktop_native_image_authority_status,
            desktop_promote_native_image_authority,
            desktop_native_image_batch,
            desktop_read_native_image,
            desktop_list_native_images,
            desktop_gc_native_image_objects,
            desktop_authority_status,
            desktop_read_authoritative_workspace,
            desktop_promote_workspace_authority,
            desktop_commit_authoritative_workspace,
            desktop_mirror_workspace,
            desktop_read_workspace_shadow,
            desktop_store_recovery_snapshot,
            desktop_read_recovery_snapshot,
            desktop_storage_status,
            desktop_backup_stream_begin,
            desktop_backup_stream_append,
            desktop_backup_stream_finalize,
            desktop_backup_stream_abort,
            desktop_write_backup
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trading Research Desktop");
}
