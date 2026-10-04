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
                .map_err(|e|format!("Staging temporal imagen: {e}"))?;
            file.write_all(&bytes).map_err(|e|format!("Staging escritura imagen: {e}"))?;
            file.sync_all().map_err(|e|format!("Staging fsync imagen: {e}"))?;
        }
        if let Err(e)=fs::rename(&temp,&target){
            let _=fs::remove_file(&temp);
            if !target.exists(){return Err(format!("Publicación de imagen nativa: {e}"));}
        }
        read_and_verify(root,expected_sha,bytes.len() as i64)?;
    }
    let at=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Transacción catálogo de imagen: {e}"))?;
    tx.execute("INSERT INTO image_staging(id,sha256,bytes,mime,name,staged_at) VALUES(?1,?2,?3,?4,?5,?6)
      ON CONFLICT(id) DO UPDATE SET sha256=excluded.sha256,bytes=excluded.bytes,mime=excluded.mime,name=excluded.name,staged_at=excluded.staged_at",
      params![id,expected_sha,bytes.len() as i64,mime,name,at])
      .map_err(|e|format!("Staging catálogo imagen: {e}"))?;
    tx.commit().map_err(|e|format!("Commit catálogo imagen: {e}"))?;
    Ok(json!({"ok":true,"staged":true,"id":id,"sha256":expected_sha,"bytes":bytes.len(),"authority":false}))
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
}
