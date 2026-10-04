/* Desktop 0.4 · authoritative workspace record. Desktop-only; Web does not load this module. */
use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{fs, path::Path};

const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS workspace_authority (
 id INTEGER PRIMARY KEY CHECK(id=1),
 payload TEXT NOT NULL,
 sha256 TEXT NOT NULL,
 revision INTEGER NOT NULL CHECK(revision>=1),
 reason TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 rollback_path TEXT NOT NULL
);";

pub(crate) fn prepare_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(SCHEMA).map_err(|e| format!("SQLite authority schema: {e}"))
}
fn digest(payload: &str) -> String {
    Sha256::digest(payload.as_bytes()).iter().map(|b| format!("{b:02x}")).collect()
}
fn validate(payload: &str) -> Result<Value, String> {
    let v: Value=serde_json::from_str(payload).map_err(|e| format!("Workspace JSON: {e}"))?;
    let object=v.as_object().ok_or("Workspace no es un objeto.")?;
    for field in ["operations","opportunities","importBatches","tradingPlans"] {
        if !object.get(field).is_some_and(Value::is_array) {
            return Err(format!("Workspace no contiene array {field}."));
        }
    }
    if object["tradingPlans"].as_array().is_some_and(Vec::is_empty) {
        return Err("Workspace no puede carecer de Trading Plans.".into());
    }
    if !object.get("settings").and_then(Value::as_object).and_then(|s|s.get("instruments")).is_some_and(Value::is_array) {
        return Err("Workspace carece de settings.instruments.".into());
    }
    Ok(v)
}
#[derive(Debug)]
struct Record {
    payload: String, sha256: String, revision: i64, reason: String,
    updated_at: String, rollback_path: String
}
fn select(conn: &Connection) -> Result<Option<Record>, String> {
    conn.query_row(
        "SELECT payload,sha256,revision,reason,updated_at,rollback_path FROM workspace_authority WHERE id=1",
        [], |r|Ok(Record{
            payload:r.get(0)?,sha256:r.get(1)?,revision:r.get(2)?,
            reason:r.get(3)?,updated_at:r.get(4)?,rollback_path:r.get(5)?
        })
    ).optional().map_err(|e|format!("Lectura SQLite authority: {e}"))
}
fn checked(row: Record) -> Result<Value,String> {
    validate(&row.payload)?;
    if row.revision < 1 || row.sha256 != digest(&row.payload) {
        return Err("SQLite authority corrupta: revisión o hash no coincide. Recuperación obligatoria.".into());
    }
    Ok(json!({
        "active":true,"payload":row.payload,"sha256":row.sha256,
        "revision":row.revision,"reason":row.reason,"updatedAt":row.updated_at,
        "rollbackPath":row.rollback_path
    }))
}
pub(crate) fn read(conn: &Connection) -> Result<Option<Value>,String> {
    select(conn)?.map(checked).transpose()
}
pub(crate) fn status(conn:&Connection) -> Result<Value,String> {
    match read(conn)? {
        None=>Ok(json!({"active":false,"revision":0})),
        Some(row)=>Ok(json!({
            "active":true,"revision":row["revision"],"sha256":row["sha256"],
            "updatedAt":row["updatedAt"],"reason":row["reason"],
            "rollbackPath":row["rollbackPath"]
        }))
    }
}
pub(crate) fn verify_rollback(root:&Path,path:&Path,payload:&str)->Result<(),String>{
    validate(payload)?;
    let parent=fs::canonicalize(root.join("backups")).map_err(|e|format!("Directorio rollback inaccesible: {e}"))?;
    let file=fs::canonicalize(path).map_err(|e|format!("Backup de migración inexistente: {e}"))?;
    if file.parent()!=Some(parent.as_path()) || file.extension().and_then(|x|x.to_str())!=Some("trbackup") {
        return Err("El rollback debe ser un .trbackup físico en la carpeta nativa backups/.".into());
    }
    let contents=fs::read_to_string(&file).map_err(|e|format!("No se puede leer rollback: {e}"))?;
    if contents.is_empty(){return Err("Rollback vacío.".into());}
    let backup:Value=serde_json::from_str(&contents).map_err(|e|format!("Rollback Backup V2 inválido: {e}"))?;
    if !backup.get("manifest").is_some_and(Value::is_object) ||
       !backup.get("images").is_some_and(Value::is_array) ||
       !backup.get("marketData").is_some_and(Value::is_object) ||
       backup.get("workspace")!=Some(&validate(payload)?) {
        return Err("Rollback no contiene el workspace exacto y la estructura Backup V2 completa.".into());
    }
    Ok(())
}
pub(crate) fn promote(conn:&mut Connection,payload:&str,rollback_path:&str)->Result<Value,String>{
    validate(payload)?;
    let sha=digest(payload);
    let tx=conn.transaction().map_err(|e|format!("Inicio promoción SQLite: {e}"))?;
    if let Some(current)=select(&tx)? {
        let existing=checked(current)?;
        if existing["sha256"]==sha && existing["rollbackPath"]==rollback_path {
            return Ok(json!({"ok":true,"alreadyPromoted":true,"revision":existing["revision"],"sha256":sha}));
        }
        return Err("La autoridad SQLite ya existe. Nunca se sobrescribe con una migración nueva.".into());
    }
    let at=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    tx.execute(
        "INSERT INTO workspace_authority(id,payload,sha256,revision,reason,updated_at,rollback_path) VALUES(1,?1,?2,1,'promotion',?3,?4)",
        params![payload,sha,at,rollback_path]
    ).map_err(|e|format!("Promoción SQLite: {e}"))?;
    tx.commit().map_err(|e|format!("Commit promoción SQLite: {e}"))?;
    let stored=read(conn)?.ok_or("Promoción no aparece tras commit.")?;
    if stored["sha256"]!=sha || stored["revision"]!=1 {
        return Err("Promoción SQLite no superó readback.".into());
    }
    Ok(json!({"ok":true,"alreadyPromoted":false,"revision":1,"sha256":sha}))
}
pub(crate) fn commit(conn:&mut Connection,payload:&str,expected_revision:i64,reason:&str)->Result<Value,String>{
    validate(payload)?;
    if expected_revision<1 {return Err("Revisión CAS inválida.".into());}
    let sha=digest(payload);
    let tx=conn.transaction().map_err(|e|format!("Inicio escritura SQLite: {e}"))?;
    let current=checked(select(&tx)?.ok_or("No existe autoridad SQLite promovida.")?)?;
    if current["revision"].as_i64()!=Some(expected_revision) {
        return Err(format!("Conflicto SQLite CAS: revisión esperada {expected_revision}, real {}. Escritura rechazada.",current["revision"]));
    }
    let next=expected_revision.checked_add(1).ok_or("Revisión SQLite desbordada.")?;
    let at=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let affected=tx.execute(
        "UPDATE workspace_authority SET payload=?1,sha256=?2,revision=?3,reason=?4,updated_at=?5 WHERE id=1 AND revision=?6",
        params![payload,sha,next,reason,at,expected_revision]
    ).map_err(|e|format!("Commit SQLite: {e}"))?;
    if affected!=1 {return Err("CAS SQLite rechazado: revisión inesperada.".into());}
    tx.commit().map_err(|e|format!("Confirmación durable SQLite: {e}"))?;
    let stored=read(conn)?.ok_or("Escritura SQLite no aparece tras commit.")?;
    if stored["revision"]!=next || stored["sha256"]!=sha {return Err("Readback SQLite no coincide con commit.".into());}
    Ok(json!({"ok":true,"revision":next,"sha256":sha,"updatedAt":at}))
}
#[cfg(test)]
mod tests {
    use super::*;
    fn db()->Connection{let c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();c}
    fn ws(n:usize)->String{json!({"tradingPlans":[{"id":"a"}],"operations":vec![json!({"id":"x"});n],"opportunities":[],"importBatches":[],"settings":{"instruments":[]}}).to_string()}
    #[test] fn rejects_empty_and_invalid(){let mut c=db();assert!(promote(&mut c,"{}","backup").is_err());assert!(promote(&mut c,"{","backup").is_err());assert!(read(&c).unwrap().is_none());}
    #[test] fn promotion_idempotent_and_cas(){let mut c=db();let p=ws(0);let first=promote(&mut c,&p,"rollback.trbackup").unwrap();assert_eq!(first["revision"],1);assert_eq!(promote(&mut c,&p,"rollback.trbackup").unwrap()["alreadyPromoted"],true);assert!(promote(&mut c,&ws(1),"rollback.trbackup").is_err());let write=commit(&mut c,&ws(1),1,"test").unwrap();assert_eq!(write["revision"],2);assert!(commit(&mut c,&ws(0),1,"stale").is_err());assert_eq!(read(&c).unwrap().unwrap()["revision"],2);}
    #[test] fn invalid_write_does_not_advance(){let mut c=db();promote(&mut c,&ws(0),"rollback").unwrap();assert!(commit(&mut c,"{}",1,"invalid").is_err());assert_eq!(read(&c).unwrap().unwrap()["revision"],1);}
    #[test] fn detects_corrupted_hash(){let mut c=db();promote(&mut c,&ws(0),"rollback").unwrap();c.execute("UPDATE workspace_authority SET sha256='bad' WHERE id=1",[]).unwrap();assert!(read(&c).is_err());assert!(commit(&mut c,&ws(1),1,"bad").is_err());}
    #[test] fn disk_reopen_and_rollback_match(){
        let dir=std::env::temp_dir().join(format!("tr-b76-disk-{}-{}",std::process::id(),Utc::now().timestamp_millis()));
        fs::create_dir_all(dir.join("backups")).unwrap();
        let rollback=dir.join("backups/migration.trbackup");
        let source=ws(0);
        let complete=json!({"workspace":serde_json::from_str::<Value>(&source).unwrap(),
            "manifest":{"schema":2},"images":[],"marketData":{"marketMeta":[],"marketTicks":[],"execSets":[]}
        }).to_string();
        fs::write(&rollback,complete).unwrap();
        verify_rollback(&dir,&rollback,&source).unwrap();
        assert!(verify_rollback(&dir,&rollback,&ws(1)).is_err());
        let path=dir.join("test.sqlite3");
        {
            let mut c=Connection::open(&path).unwrap();
            c.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;").unwrap();
            prepare_schema(&c).unwrap();
            promote(&mut c,&source,rollback.to_str().unwrap()).unwrap();
            commit(&mut c,&ws(1),1,"durable-test").unwrap();
        }
        {
            let c=Connection::open(&path).unwrap();
            prepare_schema(&c).unwrap();
            let current=read(&c).unwrap().unwrap();
            assert_eq!(current["revision"],2);
            assert_eq!(current["payload"],ws(1));
        }
        let _=fs::remove_dir_all(&dir);
    }
    #[test] fn rejects_missing_rollback(){let base=std::env::temp_dir().join(format!("tr-b76-{}",std::process::id()));fs::create_dir_all(base.join("backups")).unwrap();assert!(verify_rollback(&base,&base.join("backups/none.trbackup"),&ws(0)).is_err());let _=fs::remove_dir_all(&base);}
}
