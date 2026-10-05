/* Batch 77 / Native image staging.
 * This module is NOT an authority switch: Desktop 0.4 remains on Image IDB
 * until every read/write/GC/Backup V2 path and restart recovery is certified.
 * Image IDs never enter a filesystem path. Objects are content-addressed.
 */
use base64::{engine::general_purpose::STANDARD, Engine as _};
use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
const MAX_IMAGE_BYTES: usize = 32 * 1024 * 1024;
const SCHEMA: &str = "CREATE TABLE IF NOT EXISTS image_staging (
  id TEXT PRIMARY KEY,
  sha256 TEXT NOT NULL,
  bytes INTEGER NOT NULL CHECK(bytes>=0),
  mime TEXT NOT NULL,
  name TEXT NOT NULL,
  staged_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS image_staging_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  inventory_json TEXT NOT NULL,
  inventory_sha256 TEXT NOT NULL,
  backup_path TEXT NOT NULL,
  backup_sha256 TEXT NOT NULL,
  completed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS image_authority (
  id INTEGER PRIMARY KEY CHECK(id=1),
  generation INTEGER NOT NULL CHECK(generation>=1),
  backup_path TEXT NOT NULL,
  backup_sha256 TEXT NOT NULL,
  promoted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);";
pub(crate) fn prepare_schema(conn:&Connection)->Result<(),String>{
    conn.execute_batch(SCHEMA).map_err(|e|format!("Native image staging schema: {e}"))
}
fn hex(bytes:&[u8])->String{
    Sha256::digest(bytes).iter().map(|b|format!("{b:02x}")).collect()
}
fn checked_hash(hash:&str)->Result<&str,String>{
    if hash.len()!=64 || !hash.bytes().all(|b|b.is_ascii_hexdigit()&&(!b.is_ascii_alphabetic()||b.is_ascii_lowercase())) {
        return Err("SHA-256 image inválido.".into());
    }
    Ok(hash)
}
fn checked_id(id:&str)->Result<&str,String>{
    if id.is_empty()||id.len()>256||id.chars().any(|ch|ch.is_control()) {return Err("ID de imagen inválido.".into());}
    Ok(id)
}
fn object_path(root:&Path,hash:&str)->Result<PathBuf,String>{
    checked_hash(hash)?;
    Ok(root.join("images").join("objects").join(format!("{hash}.blob")))
}
fn authority_marker_path(root:&Path)->PathBuf{
    root.join("native-images-authority.marker")
}
fn ensure_authority_marker(root:&Path)->Result<(),String>{
    let final_path=authority_marker_path(root);
    if final_path.exists(){
        let meta=fs::metadata(&final_path).map_err(|e|format!("Marcador de imágenes nativas inaccesible: {e}"))?;
        if !meta.is_file()||meta.len()==0{return Err("Marcador de autoridad de imágenes inválido.".into());}
        return Ok(());
    }
    let temp=root.join(".native-images-authority.marker.tmp");
    {
        let mut file=OpenOptions::new().create(true).write(true).truncate(true).open(&temp)
          .map_err(|e|format!("Creación marcador imágenes: {e}"))?;
        file.write_all(b"Trading Research Desktop: NATIVE IMAGE AUTHORITY; never fall back silently to IndexedDB\n")
          .map_err(|e|format!("Escritura marcador imágenes: {e}"))?;
        file.sync_all().map_err(|e|format!("fsync marcador imágenes: {e}"))?;
    }
    fs::rename(&temp,&final_path).map_err(|e|format!("Publicación marcador imágenes: {e}"))?;
    Ok(())
}
fn prepare_object(root:&Path,data:&str,expected_sha:&str)->Result<i64,String>{
    checked_hash(expected_sha)?;
    if data.len()>(MAX_IMAGE_BYTES*4/3+8){return Err("Imagen nativa demasiado grande.".into());}
    let bytes=STANDARD.decode(data).map_err(|e|format!("Imagen base64 inválida: {e}"))?;
    if bytes.is_empty()||bytes.len()>MAX_IMAGE_BYTES{return Err("Imagen nativa vacía o demasiado grande.".into());}
    if hex(&bytes)!=expected_sha{return Err("La imagen no coincide con el SHA-256 certificado.".into());}
    let dir=root.join("images").join("objects");
    fs::create_dir_all(&dir).map_err(|e|format!("Directorio de objetos nativos: {e}"))?;
    let target=object_path(root,expected_sha)?;
    if target.exists(){
        read_and_verify(root,expected_sha,bytes.len() as i64)?;
    }else{
        let temp=dir.join(format!(".{}-{}-{}.tmp",expected_sha,std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        {
            let mut file=OpenOptions::new().write(true).create_new(true).open(&temp)
                .map_err(|e|format!("Temporal imagen nativa: {e}"))?;
            file.write_all(&bytes).map_err(|e|format!("Escritura imagen nativa: {e}"))?;
            file.sync_all().map_err(|e|format!("fsync imagen nativa: {e}"))?;
        }
        if let Err(e)=fs::rename(&temp,&target){
            let _=fs::remove_file(&temp);
            if !target.exists(){return Err(format!("Publicación de imagen nativa: {e}"));}
        }
        read_and_verify(root,expected_sha,bytes.len() as i64)?;
    }
    Ok(bytes.len() as i64)
}
fn read_and_verify(root:&Path,hash:&str,expected_bytes:i64)->Result<Vec<u8>,String>{
    let path=object_path(root,hash)?;
    let metadata=fs::symlink_metadata(&path).map_err(|e|format!("Objeto de imagen inexistente: {e}"))?;
    if !metadata.file_type().is_file()||metadata.len()!=expected_bytes as u64||metadata.len()>MAX_IMAGE_BYTES as u64{
        return Err("Objeto de imagen alterado o fuera de límites.".into());
    }
    let mut buf=Vec::with_capacity(metadata.len() as usize);
    fs::File::open(&path).and_then(|mut f|f.read_to_end(&mut buf))
        .map_err(|e|format!("Lectura de objeto de imagen: {e}"))?;
    if hex(&buf)!=hash{return Err("Imagen nativa corrupta: SHA-256 no coincide.".into());}
    Ok(buf)
}
fn row(conn:&Connection,id:&str)->Result<Option<(String,i64,String,String)>,String>{
    checked_id(id)?;
    conn.query_row("SELECT sha256,bytes,mime,name FROM image_staging WHERE id=?1",params![id],
        |r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?)))
        .optional().map_err(|e|format!("Catálogo de imagen nativa: {e}"))
}
pub(crate) fn stage(conn:&mut Connection,root:&Path,id:&str,data:&str,expected_sha:&str,mime:&str,name:&str)->Result<Value,String>{
    checked_id(id)?;checked_hash(expected_sha)?;
    if mime.is_empty()||mime.len()>128||name.len()>512{return Err("Metadatos de imagen fuera de límites.".into());}
    let bytes=prepare_object(root,data,expected_sha)?;
    let at=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Transacción catálogo de imagen: {e}"))?;
    tx.execute("INSERT INTO image_staging(id,sha256,bytes,mime,name,staged_at) VALUES(?1,?2,?3,?4,?5,?6)
      ON CONFLICT(id) DO UPDATE SET sha256=excluded.sha256,bytes=excluded.bytes,mime=excluded.mime,name=excluded.name,staged_at=excluded.staged_at",
      params![id,expected_sha,bytes,mime,name,at])
      .map_err(|e|format!("Staging catálogo imagen: {e}"))?;
    tx.commit().map_err(|e|format!("Commit catálogo imagen: {e}"))?;
    Ok(json!({"ok":true,"staged":true,"id":id,"sha256":expected_sha,"bytes":bytes,"authority":false}))
}
pub(crate) fn read(conn:&Connection,root:&Path,id:&str)->Result<Value,String>{
    let (sha,len,mime,name)=row(conn,id)?.ok_or("Imagen no registrada en catálogo staging nativo.")?;
    let bytes=read_and_verify(root,&sha,len)?;
    Ok(json!({"id":id,"sha256":sha,"bytes":len,"mime":mime,"name":name,"data":STANDARD.encode(bytes),"authority":false}))
}
pub(crate) fn verify(conn:&Connection,root:&Path,expected:&[(String,String)])->Result<Value,String>{
    let mut seen=std::collections::HashSet::new();
    for (id,hash) in expected{
        checked_id(id)?;checked_hash(hash)?;
        if !seen.insert(id){return Err("ID duplicado en inventario nativo requerido.".into());}
        let (stored,size,_,_)=row(conn,id)?.ok_or_else(||format!("Imagen pendiente en staging: {id}"))?;
        if stored!=*hash{return Err(format!("Hash de imagen distinto en catálogo: {id}"));}
        read_and_verify(root,&stored,size)?;
    }
    Ok(json!({"ok":true,"stagedImages":expected.len(),"authority":false}))
}

fn inventory_json(expected:&[(String,String)])->Result<String,String>{
    let mut copy=expected.to_vec();
    copy.sort_by(|a,b|a.0.cmp(&b.0));
    let mut seen=std::collections::HashSet::new();
    for (id,hash) in &copy {
        checked_id(id)?; checked_hash(hash)?;
        if !seen.insert(id.clone()){return Err("ID duplicado en inventario de staging.".into());}
    }
    serde_json::to_string(&copy).map_err(|e|format!("Inventario de staging JSON: {e}"))
}
pub(crate) fn finalize(conn:&mut Connection,root:&Path,expected:&[(String,String)],backup_path:&str,backup_sha:&str)->Result<Value,String>{
    verify(conn,root,expected)?;
    checked_hash(backup_sha)?;
    let inventory=inventory_json(expected)?;
    let inventory_sha=hex(inventory.as_bytes());
    let completed=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Transacción cierre staging imágenes: {e}"))?;
    tx.execute("INSERT INTO image_staging_state(id,inventory_json,inventory_sha256,backup_path,backup_sha256,completed_at)
      VALUES(1,?1,?2,?3,?4,?5)
      ON CONFLICT(id) DO UPDATE SET inventory_json=excluded.inventory_json,inventory_sha256=excluded.inventory_sha256,
      backup_path=excluded.backup_path,backup_sha256=excluded.backup_sha256,completed_at=excluded.completed_at",
      params![inventory,inventory_sha,backup_path,backup_sha,completed])
      .map_err(|e|format!("Cierre staging imágenes: {e}"))?;
    tx.commit().map_err(|e|format!("Commit cierre staging imágenes: {e}"))?;
    Ok(json!({"ok":true,"authority":false,"stagedImages":expected.len(),"inventorySha256":inventory_sha,
      "backupPath":backup_path,"backupSha256":backup_sha,"completedAt":completed}))
}
pub(crate) fn status(conn:&Connection,root:&Path)->Result<Value,String>{
    let catalog:i64=conn.query_row("SELECT COUNT(*) FROM image_staging",[],|r|r.get(0))
      .map_err(|e|format!("Conteo catálogo imágenes: {e}"))?;
    let state:Option<(String,String,String,String)>=conn.query_row(
      "SELECT inventory_sha256,backup_path,backup_sha256,completed_at FROM image_staging_state WHERE id=1",[],
      |r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional()
      .map_err(|e|format!("Estado staging imágenes: {e}"))?;
    let object_dir=root.join("images").join("objects");
    let mut objects=0_i64;
    if object_dir.exists(){
      objects=fs::read_dir(&object_dir).map_err(|e|format!("Inventario objetos nativos: {e}"))?
        .filter_map(Result::ok).filter(|e|e.path().extension().and_then(|x|x.to_str())==Some("blob")).count() as i64;
    }
    Ok(match state {
      Some((inventory_sha,backup_path,backup_sha,completed))=>json!({"ok":true,"authority":false,"complete":true,
        "catalogRecords":catalog,"objects":objects,"inventorySha256":inventory_sha,"backupPath":backup_path,
        "backupSha256":backup_sha,"completedAt":completed}),
      None=>json!({"ok":true,"authority":false,"complete":false,"catalogRecords":catalog,"objects":objects})
    })
}


fn authority_row(conn:&Connection)->Result<Option<(i64,String,String,String,String)>,String>{
    conn.query_row("SELECT generation,backup_path,backup_sha256,promoted_at,updated_at FROM image_authority WHERE id=1",[],
      |r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional()
      .map_err(|e|format!("Autoridad de imágenes nativas: {e}"))
}
fn verify_catalog_presence(conn:&Connection,root:&Path,deep:bool)->Result<i64,String>{
    let mut stmt=conn.prepare("SELECT id,sha256,bytes FROM image_staging ORDER BY id")
      .map_err(|e|format!("Catálogo imágenes verify: {e}"))?;
    let mut rows=stmt.query([]).map_err(|e|format!("Catálogo imágenes rows: {e}"))?;
    let mut count=0_i64;
    while let Some(r)=rows.next().map_err(|e|format!("Catálogo imágenes row: {e}"))?{
        let id:String=r.get(0).map_err(|e|e.to_string())?;
        let sha:String=r.get(1).map_err(|e|e.to_string())?;
        let bytes:i64=r.get(2).map_err(|e|e.to_string())?;
        checked_id(&id)?;checked_hash(&sha)?;
        let path=object_path(root,&sha)?;
        let meta=fs::symlink_metadata(&path).map_err(|e|format!("Objeto nativo faltante para {id}: {e}"))?;
        if !meta.file_type().is_file()||meta.len()!=bytes as u64{return Err(format!("Objeto nativo inválido para {id}."));}
        if deep{read_and_verify(root,&sha,bytes)?;}
        count+=1;
    }
    Ok(count)
}
pub(crate) fn authority_status(conn:&Connection,root:&Path,deep:bool)->Result<Value,String>{
    let row=authority_row(conn)?;
    if row.is_none()&&authority_marker_path(root).exists(){
        return Err("Existe marcador de autoridad de imágenes, pero falta su registro SQLite. Recuperación obligatoria.".into());
    }
    if let Some((generation,backup_path,backup_sha,promoted_at,updated_at))=row{
        ensure_authority_marker(root)?;
        let count=verify_catalog_presence(conn,root,deep)?;
        return Ok(json!({"ok":true,"active":true,"generation":generation,"catalogRecords":count,
          "backupPath":backup_path,"backupSha256":backup_sha,"promotedAt":promoted_at,"updatedAt":updated_at,
          "deepVerified":deep}));
    }
    Ok(json!({"ok":true,"active":false,"generation":0,"catalogRecords":0,"deepVerified":deep}))
}
pub(crate) fn promote(conn:&mut Connection,root:&Path,expected:&[(String,String)],backup_path:&str,backup_sha:&str)->Result<Value,String>{
    if let Some((generation,existing_path,existing_sha,promoted_at,_))=authority_row(conn)?{
        if existing_path!=backup_path||existing_sha!=backup_sha{
            return Err("La autoridad de imágenes ya fue promovida con otro rollback; no se re-promueve.".into());
        }
        ensure_authority_marker(root)?;
        let count=verify_catalog_presence(conn,root,true)?;
        return Ok(json!({"ok":true,"active":true,"generation":generation,"images":count,
          "promotedAt":promoted_at,"idempotent":true}));
    }
    let staging:Option<(String,String,String)>=conn.query_row(
      "SELECT inventory_json,backup_path,backup_sha256 FROM image_staging_state WHERE id=1",[],
      |r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional()
      .map_err(|e|format!("Estado previo staging imágenes: {e}"))?;
    let (stored_inventory,stored_backup,stored_backup_sha)=staging.ok_or("No existe staging nativo completo para promover.")?;
    let expected_json=inventory_json(expected)?;
    if stored_inventory!=expected_json||stored_backup!=backup_path||stored_backup_sha!=backup_sha{
        return Err("El staging no coincide con el inventario/rollback que se intenta promover.".into());
    }
    verify(conn,root,expected)?;
    ensure_authority_marker(root)?;
    let now=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Transacción promoción imágenes: {e}"))?;
    {
        let mut stmt=tx.prepare("SELECT id FROM image_staging").map_err(|e|e.to_string())?;
        let ids=stmt.query_map([],|r|r.get::<_,String>(0)).map_err(|e|e.to_string())?
          .collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
        let keep:std::collections::HashSet<&str>=expected.iter().map(|(id,_)|id.as_str()).collect();
        for id in ids{if !keep.contains(id.as_str()){tx.execute("DELETE FROM image_staging WHERE id=?1",params![id]).map_err(|e|e.to_string())?;}}
    }
    tx.execute("INSERT INTO image_authority(id,generation,backup_path,backup_sha256,promoted_at,updated_at)
      VALUES(1,1,?1,?2,?3,?3)
      ON CONFLICT(id) DO NOTHING",params![backup_path,backup_sha,now])
      .map_err(|e|format!("Promoción autoridad imágenes: {e}"))?;
    let generation:i64=tx.query_row("SELECT generation FROM image_authority WHERE id=1",[],|r|r.get(0))
      .map_err(|e|format!("Readback promoción imágenes: {e}"))?;
    tx.commit().map_err(|e|format!("Commit promoción imágenes: {e}"))?;
    Ok(json!({"ok":true,"active":true,"generation":generation,"images":expected.len(),"promotedAt":now}))
}
fn require_generation(tx:&rusqlite::Transaction<'_>,expected:i64)->Result<(),String>{
    let current:i64=tx.query_row("SELECT generation FROM image_authority WHERE id=1",[],|r|r.get(0))
      .map_err(|_|"Autoridad de imágenes no activa.".to_string())?;
    if current!=expected{return Err(format!("Conflicto de generación de imágenes: esperado {expected}, actual {current}."));}
    Ok(())
}
fn put_fields(value:&Value)->Result<(String,String,String,String,String,String),String>{
    let id=value.get("id").and_then(Value::as_str).ok_or("Imagen put sin id.")?.to_owned();
    let data=value.get("data").and_then(Value::as_str).ok_or("Imagen put sin data.")?.to_owned();
    let sha=value.get("sha256").and_then(Value::as_str).ok_or("Imagen put sin sha256.")?.to_owned();
    let mime=value.get("mime").and_then(Value::as_str).unwrap_or("application/octet-stream").to_owned();
    let name=value.get("name").and_then(Value::as_str).unwrap_or("imagen").to_owned();
    let updated=value.get("updatedAt").and_then(Value::as_str).unwrap_or("").to_owned();
    checked_id(&id)?;checked_hash(&sha)?;
    if mime.is_empty()||mime.len()>128||name.len()>512{return Err("Metadatos de imagen fuera de límites.".into());}
    Ok((id,data,sha,mime,name,updated))
}
pub(crate) fn batch_commit(conn:&mut Connection,root:&Path,puts:&[Value],deletes:&[String],expected_generation:i64,reason:&str)->Result<Value,String>{
    if reason.is_empty()||reason.len()>160{return Err("Razón de commit de imágenes inválida.".into());}
    let mut prepared=Vec::with_capacity(puts.len());
    for value in puts{
        let fields=put_fields(value)?;
        let size=prepare_object(root,&fields.1,&fields.2)?;
        prepared.push((fields,size));
    }
    for id in deletes{checked_id(id)?;}
    let now=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Transacción imágenes nativas: {e}"))?;
    require_generation(&tx,expected_generation)?;
    for ((id,_data,sha,mime,name,updated),size) in prepared{
        let at=if updated.is_empty(){now.as_str()}else{updated.as_str()};
        tx.execute("INSERT INTO image_staging(id,sha256,bytes,mime,name,staged_at) VALUES(?1,?2,?3,?4,?5,?6)
          ON CONFLICT(id) DO UPDATE SET sha256=excluded.sha256,bytes=excluded.bytes,mime=excluded.mime,name=excluded.name,staged_at=excluded.staged_at",
          params![id,sha,size,mime,name,at]).map_err(|e|format!("Put imagen nativa: {e}"))?;
    }
    for id in deletes{tx.execute("DELETE FROM image_staging WHERE id=?1",params![id]).map_err(|e|format!("Delete imagen nativa: {e}"))?;}
    let next=expected_generation.checked_add(1).ok_or("Overflow generación imágenes.")?;
    let changed=tx.execute("UPDATE image_authority SET generation=?1,updated_at=?2 WHERE id=1 AND generation=?3",
      params![next,now,expected_generation]).map_err(|e|format!("CAS imágenes: {e}"))?;
    if changed!=1{return Err("CAS de imágenes rechazado.".into());}
    tx.commit().map_err(|e|format!("Commit imágenes nativas: {e}"))?;
    Ok(json!({"ok":true,"active":true,"generation":next,"puts":puts.len(),"deletes":deletes.len(),"reason":reason,"updatedAt":now}))
}
pub(crate) fn list(conn:&Connection)->Result<Value,String>{
    let mut stmt=conn.prepare("SELECT id,sha256,bytes,mime,name,staged_at FROM image_staging ORDER BY id")
      .map_err(|e|format!("Lista imágenes nativas: {e}"))?;
    let rows=stmt.query_map([],|r|Ok(json!({"id":r.get::<_,String>(0)?,"sha256":r.get::<_,String>(1)?,
      "bytes":r.get::<_,i64>(2)?,"mime":r.get::<_,String>(3)?,"name":r.get::<_,String>(4)?,
      "updatedAt":r.get::<_,String>(5)?}))).map_err(|e|e.to_string())?
      .collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
    Ok(Value::Array(rows))
}
pub(crate) fn read_active(conn:&Connection,root:&Path,id:&str)->Result<Value,String>{
    if authority_row(conn)?.is_none(){return Err("Autoridad de imágenes nativas no activa.".into());}
    let mut value=read(conn,root,id)?;
    value["authority"]=Value::Bool(true);
    Ok(value)
}
pub(crate) fn gc_objects(conn:&Connection,root:&Path)->Result<Value,String>{
    if authority_row(conn)?.is_none(){return Err("GC nativo requiere autoridad de imágenes activa.".into());}
    let mut stmt=conn.prepare("SELECT DISTINCT sha256 FROM image_staging").map_err(|e|e.to_string())?;
    let keep:std::collections::HashSet<String>=stmt.query_map([],|r|r.get::<_,String>(0)).map_err(|e|e.to_string())?
      .collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?.into_iter().collect();
    let dir=root.join("images").join("objects");let mut removed=0usize;let mut kept=0usize;
    if dir.exists(){
      for entry in fs::read_dir(&dir).map_err(|e|format!("GC objetos imágenes: {e}"))?{
        let entry=entry.map_err(|e|e.to_string())?;let path=entry.path();
        if path.extension().and_then(|x|x.to_str())!=Some("blob"){continue;}
        let stem=path.file_stem().and_then(|x|x.to_str()).unwrap_or("");
        if keep.contains(stem){kept+=1;}else{fs::remove_file(&path).map_err(|e|format!("GC delete objeto imagen: {e}"))?;removed+=1;}
      }
    }
    Ok(json!({"ok":true,"removed":removed,"kept":kept}))
}

#[cfg(test)]
mod tests{
    use super::*;
    fn setup()->(PathBuf,Connection){
        let root=std::env::temp_dir().join(format!("tr-b77-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&root).unwrap();
        let c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();(root,c)
    }
    #[test] fn idempotent_roundtrip_and_restart_file(){
        let (root,mut c)=setup();let bytes=b"image-test-01";let sha=hex(bytes);let data=STANDARD.encode(bytes);
        let x=stage(&mut c,&root,"../../opaque/image-id",&data,&sha,"image/png","safe").unwrap();
        assert_eq!(x["authority"],false);
        assert_eq!(stage(&mut c,&root,"../../opaque/image-id",&data,&sha,"image/png","safe").unwrap()["sha256"],sha);
        let out=read(&c,&root,"../../opaque/image-id").unwrap();assert_eq!(out["data"],data);
        assert_eq!(verify(&c,&root,&[("../../opaque/image-id".to_owned(),sha)]).unwrap()["stagedImages"],1);
        assert!(!root.join("opaque").exists());
        let _=fs::remove_dir_all(root);
    }
    #[test] fn fail_closed_corruption_and_hash_mismatch(){
        let(root,mut c)=setup();let bytes=b"original";let sha=hex(bytes);let data=STANDARD.encode(bytes);
        assert!(stage(&mut c,&root,"a",&data,&hex(b"different"),"image/png","x").is_err());
        stage(&mut c,&root,"a",&data,&sha,"image/png","x").unwrap();
        fs::write(object_path(&root,&sha).unwrap(),b"corrupt!").unwrap();
        assert!(read(&c,&root,"a").is_err());
        assert!(verify(&c,&root,&[("a".into(),sha)]).is_err());
        let _=fs::remove_dir_all(root);
    }
    #[test] fn rejects_duplicate_ids_missing_objects_and_empty_payload(){
        let(root,mut c)=setup();let sha=hex(b"x");
        assert!(stage(&mut c,&root,"a","",&sha,"image/png","x").is_err());
        assert!(verify(&c,&root,&[("a".into(),sha.clone())]).is_err());
        stage(&mut c,&root,"a",&STANDARD.encode(b"x"),&sha,"image/png","x").unwrap();
        assert!(verify(&c,&root,&[("a".into(),sha.clone()),("a".into(),sha)]).is_err());
        let _=fs::remove_dir_all(root);
    }
    #[test] fn finalize_records_only_verified_inventory_and_backup_hash(){
        let(root,mut c)=setup();let sha=hex(b"x");
        stage(&mut c,&root,"a",&STANDARD.encode(b"x"),&sha,"image/png","x").unwrap();
        let backup_sha=hex(b"backup");
        let done=finalize(&mut c,&root,&[("a".into(),sha.clone())],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        assert_eq!(done["stagedImages"],1);
        let st=status(&c,&root).unwrap();
        assert_eq!(st["complete"],true); assert_eq!(st["catalogRecords"],1); assert_eq!(st["authority"],false);
        assert!(finalize(&mut c,&root,&[("missing".into(),sha)],"x",&backup_sha).is_err());
        let _=fs::remove_dir_all(root);
    }
    #[test] fn promote_and_cas_batch_are_fail_closed(){
        let(root,mut c)=setup();let sha=hex(b"x");let backup_sha=hex(b"backup");
        stage(&mut c,&root,"a",&STANDARD.encode(b"x"),&sha,"image/png","x").unwrap();
        finalize(&mut c,&root,&[("a".into(),sha.clone())],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        let p=promote(&mut c,&root,&[("a".into(),sha.clone())],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        assert_eq!(p["generation"],1);assert!(authority_marker_path(&root).exists());
        let put=json!({"id":"b","data":STANDARD.encode(b"y"),"sha256":hex(b"y"),"mime":"image/png","name":"y","updatedAt":""});
        let w=batch_commit(&mut c,&root,&[put],&[],1,"test").unwrap();assert_eq!(w["generation"],2);
        assert!(batch_commit(&mut c,&root,&[],&["a".into()],1,"stale").is_err());
        assert_eq!(authority_status(&c,&root,true).unwrap()["generation"],2);
        assert_eq!(read_active(&c,&root,"b").unwrap()["authority"],true);
        let _=fs::remove_dir_all(root);
    }
    #[test] fn marker_without_authority_is_fatal(){
        let(root,c)=setup();ensure_authority_marker(&root).unwrap();
        assert!(authority_status(&c,&root,false).is_err());
        let _=fs::remove_dir_all(root);
    }
    #[test] fn repeated_promotion_never_prunes_newer_catalog(){
        let(root,mut c)=setup();let sha=hex(b"x");let backup_sha=hex(b"backup");
        stage(&mut c,&root,"a",&STANDARD.encode(b"x"),&sha,"image/png","x").unwrap();
        finalize(&mut c,&root,&[("a".into(),sha.clone())],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        promote(&mut c,&root,&[("a".into(),sha.clone())],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        let put=json!({"id":"b","data":STANDARD.encode(b"y"),"sha256":hex(b"y"),"mime":"image/png","name":"y","updatedAt":""});
        batch_commit(&mut c,&root,&[put],&[],1,"add-b").unwrap();
        let again=promote(&mut c,&root,&[("a".into(),sha)],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        assert_eq!(again["generation"],2);assert_eq!(again["idempotent"],true);
        assert!(row(&c,"b").unwrap().is_some());
        let _=fs::remove_dir_all(root);
    }
    #[test] fn authority_survives_real_sqlite_reopen(){
        let root=std::env::temp_dir().join(format!("tr-b77-reopen-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&root).unwrap();let db=root.join("images.sqlite");
        let sha=hex(b"persist");let backup_sha=hex(b"backup");
        {
          let mut c=Connection::open(&db).unwrap();prepare_schema(&c).unwrap();
          stage(&mut c,&root,"a",&STANDARD.encode(b"persist"),&sha,"image/png","persist").unwrap();
          finalize(&mut c,&root,&[("a".into(),sha.clone())],"C:/safe/reopen.trbackup",&backup_sha).unwrap();
          promote(&mut c,&root,&[("a".into(),sha)],"C:/safe/reopen.trbackup",&backup_sha).unwrap();
        }
        {
          let c=Connection::open(&db).unwrap();prepare_schema(&c).unwrap();
          let status=authority_status(&c,&root,true).unwrap();
          assert_eq!(status["active"],true);assert_eq!(status["generation"],1);assert_eq!(status["catalogRecords"],1);
          assert_eq!(read_active(&c,&root,"a").unwrap()["authority"],true);
        }
        let _=fs::remove_dir_all(root);
    }
    #[test] fn stale_cas_can_leave_only_unreferenced_object_not_catalog_mutation(){
        let(root,mut c)=setup();let sha=hex(b"x");let backup_sha=hex(b"backup");
        stage(&mut c,&root,"a",&STANDARD.encode(b"x"),&sha,"image/png","x").unwrap();
        finalize(&mut c,&root,&[("a".into(),sha.clone())],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        promote(&mut c,&root,&[("a".into(),sha)],"C:/safe/rollback.trbackup",&backup_sha).unwrap();
        let put=json!({"id":"b","data":STANDARD.encode(b"orphan"),"sha256":hex(b"orphan"),"mime":"image/png","name":"o","updatedAt":""});
        assert!(batch_commit(&mut c,&root,&[put],&[],0,"stale").is_err());
        assert!(row(&c,"b").unwrap().is_none());
        let gc=gc_objects(&c,&root).unwrap();assert_eq!(gc["removed"],1);
        let _=fs::remove_dir_all(root);
    }
}
