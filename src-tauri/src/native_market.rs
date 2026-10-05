/* Batch 78 · Native Market Data staging.
 *
 * This module deliberately does NOT make native Market Data authoritative yet.
 * IndexedDB remains live until the migration, Backup V2 rollback and Desktop
 * adapter are all certified. Tick traffic is bounded to MAX_CHUNK_ROWS so no
 * Tauri command carries an unbounded historical dataset.
 */
use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::{self,OpenOptions};
use std::io::Write;
use std::path::{Path,PathBuf};

pub(crate) const MAX_CHUNK_ROWS: usize = 25_000;
pub(crate) const MAX_DATASET_ROWS: usize = 2_000_000;

const SCHEMA:&str=r#"
CREATE TABLE IF NOT EXISTS market_stage_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  generation INTEGER NOT NULL CHECK(generation>=1),
  rollback_path TEXT NOT NULL,
  rollback_sha256 TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  inventory_json TEXT,
  inventory_sha256 TEXT
);
CREATE TABLE IF NOT EXISTS market_meta_native (
  generation INTEGER NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY(generation,id)
);
CREATE TABLE IF NOT EXISTS market_exec_native (
  generation INTEGER NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY(generation,id)
);
CREATE TABLE IF NOT EXISTS market_tick_chunk_native (
  generation INTEGER NOT NULL,
  dataset_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK(chunk_index>=0),
  row_count INTEGER NOT NULL CHECK(row_count>=0),
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY(generation,dataset_id,chunk_index)
);
CREATE TABLE IF NOT EXISTS market_tick_catalog_native (
  generation INTEGER NOT NULL,
  dataset_id TEXT NOT NULL,
  chunk_count INTEGER NOT NULL CHECK(chunk_count>=0),
  row_count INTEGER NOT NULL CHECK(row_count>=0),
  aggregate_sha256 TEXT NOT NULL,
  PRIMARY KEY(generation,dataset_id)
);
CREATE TABLE IF NOT EXISTS market_authority_native (
  id INTEGER PRIMARY KEY CHECK(id=1),
  generation INTEGER NOT NULL CHECK(generation>=1),
  rollback_path TEXT NOT NULL,
  rollback_sha256 TEXT NOT NULL,
  promoted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_meta_active (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_exec_active (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_tick_chunk_active (
  dataset_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL CHECK(chunk_index>=0),
  row_count INTEGER NOT NULL CHECK(row_count>=0),
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY(dataset_id,chunk_index)
);
CREATE TABLE IF NOT EXISTS market_tick_catalog_active (
  dataset_id TEXT PRIMARY KEY,
  chunk_count INTEGER NOT NULL CHECK(chunk_count>=0),
  row_count INTEGER NOT NULL CHECK(row_count>=0),
  aggregate_sha256 TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_pending_op (
  op_id TEXT PRIMARY KEY,
  expected_generation INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS market_pending_record (
  op_id TEXT NOT NULL,
  store TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY(op_id,store,id)
);
CREATE TABLE IF NOT EXISTS market_pending_delete (
  op_id TEXT NOT NULL,
  store TEXT NOT NULL,
  id TEXT NOT NULL,
  PRIMARY KEY(op_id,store,id)
);
CREATE TABLE IF NOT EXISTS market_pending_tick_chunk (
  op_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  payload TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY(op_id,dataset_id,chunk_index)
);
CREATE TABLE IF NOT EXISTS market_pending_tick_catalog (
  op_id TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  chunk_count INTEGER NOT NULL,
  row_count INTEGER NOT NULL,
  aggregate_sha256 TEXT NOT NULL,
  PRIMARY KEY(op_id,dataset_id)
);
"#;

pub(crate) fn prepare_schema(conn:&Connection)->Result<(),String>{
    conn.execute_batch(SCHEMA).map_err(|e|format!("Native Market Data schema: {e}"))
}

fn hex(bytes:&[u8])->String{
    Sha256::digest(bytes).iter().map(|b|format!("{b:02x}")).collect()
}
fn sha_text(s:&str)->String{hex(s.as_bytes())}
fn checked_hash(v:&str)->Result<&str,String>{
    if v.len()!=64||!v.bytes().all(|b|b.is_ascii_hexdigit()&&(!b.is_ascii_alphabetic()||b.is_ascii_lowercase())){
        return Err("SHA-256 Market Data inválido.".into());
    }
    Ok(v)
}
fn checked_id(v:&str)->Result<&str,String>{
    if v.is_empty()||v.len()>256||v.chars().any(|c|c.is_control()){
        return Err("ID Market Data inválido.".into());
    }
    Ok(v)
}
fn object_payload(payload:&str,id:&str,label:&str)->Result<Value,String>{
    checked_id(id)?;
    let v:Value=serde_json::from_str(payload).map_err(|e|format!("{label} JSON inválido: {e}"))?;
    if !v.is_object(){return Err(format!("{label} debe ser un objeto JSON."));}
    if v.get("id").and_then(Value::as_str)!=Some(id){return Err(format!("{label} id no coincide."));}
    Ok(v)
}
fn tick_payload(payload:&str)->Result<Vec<Value>,String>{
    let v:Value=serde_json::from_str(payload).map_err(|e|format!("Chunk ticks JSON inválido: {e}"))?;
    let rows=v.as_array().ok_or("Chunk ticks debe ser un array JSON.")?;
    if rows.is_empty(){return Err("Chunk ticks vacío.".into());}
    if rows.len()>MAX_CHUNK_ROWS{return Err(format!("Chunk ticks supera {MAX_CHUNK_ROWS} filas."));}
    for (i,row) in rows.iter().enumerate(){
        let a=row.as_array().ok_or_else(||format!("Tick {i} no es array."))?;
        if a.len()!=6||!a.iter().all(Value::is_number){
            return Err(format!("Tick {i} no tiene las 6 columnas numéricas esperadas."));
        }
    }
    Ok(rows.clone())
}
fn active_generation(conn:&Connection)->Result<Option<i64>,String>{
    conn.query_row("SELECT generation FROM market_authority_native WHERE id=1",[],|r|r.get(0))
        .optional().map_err(|e|format!("Lectura autoridad Market Data: {e}"))
}
fn stage_row(conn:&Connection)->Result<Option<(i64,String,String,Option<String>)>,String>{
    conn.query_row(
        "SELECT generation,rollback_path,rollback_sha256,completed_at FROM market_stage_state WHERE id=1",
        [],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))
    ).optional().map_err(|e|format!("Lectura staging Market Data: {e}"))
}
fn clear_generation(conn:&Connection,g:i64)->Result<(),String>{
    for table in ["market_meta_native","market_exec_native","market_tick_chunk_native","market_tick_catalog_native"]{
        conn.execute(&format!("DELETE FROM {table} WHERE generation=?1"),params![g])
            .map_err(|e|format!("Limpieza {table}: {e}"))?;
    }
    Ok(())
}

pub(crate) fn begin_stage(conn:&mut Connection,rollback_path:&str,rollback_sha:&str)->Result<Value,String>{
    checked_hash(rollback_sha)?;
    if rollback_path.trim().is_empty(){return Err("Rollback físico requerido para staging Market Data.".into());}
    if let Some((g,p,h,done))=stage_row(conn)?{
        if done.is_none()&&p==rollback_path&&h==rollback_sha{
            return Ok(json!({"ok":true,"generation":g,"resumed":true,"authority":false}));
        }
    }
    let current=active_generation(conn)?.unwrap_or(0);
    let prior_stage=stage_row(conn)?.map(|x|x.0).unwrap_or(0);
    let g=current.max(prior_stage)+1;
    let at=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Inicio staging Market Data: {e}"))?;
    clear_generation(&tx,g)?;
    tx.execute(
      "INSERT INTO market_stage_state(id,generation,rollback_path,rollback_sha256,started_at,completed_at,inventory_json,inventory_sha256)
       VALUES(1,?1,?2,?3,?4,NULL,NULL,NULL)
       ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,rollback_path=excluded.rollback_path,
         rollback_sha256=excluded.rollback_sha256,started_at=excluded.started_at,completed_at=NULL,inventory_json=NULL,inventory_sha256=NULL",
      params![g,rollback_path,rollback_sha,at]
    ).map_err(|e|format!("Registro staging Market Data: {e}"))?;
    tx.commit().map_err(|e|format!("Commit staging Market Data: {e}"))?;
    Ok(json!({"ok":true,"generation":g,"resumed":false,"authority":false}))
}
fn require_stage(conn:&Connection,g:i64)->Result<(),String>{
    let row=stage_row(conn)?.ok_or("No existe staging Market Data activo.")?;
    if row.0!=g{return Err(format!("Generación staging obsoleta: esperada {}, recibida {g}.",row.0));}
    if row.3.is_some(){return Err("El staging Market Data ya fue cerrado.".into());}
    Ok(())
}

pub(crate) fn stage_meta(conn:&mut Connection,g:i64,id:&str,payload:&str,expected_sha:&str)->Result<Value,String>{
    require_stage(conn,g)?;object_payload(payload,id,"marketMeta")?;checked_hash(expected_sha)?;
    if sha_text(payload)!=expected_sha{return Err("Hash marketMeta no coincide.".into());}
    conn.execute(
      "INSERT INTO market_meta_native(generation,id,payload,sha256) VALUES(?1,?2,?3,?4)
       ON CONFLICT(generation,id) DO UPDATE SET payload=excluded.payload,sha256=excluded.sha256",
      params![g,id,payload,expected_sha]
    ).map_err(|e|format!("Staging marketMeta: {e}"))?;
    Ok(json!({"ok":true,"generation":g,"id":id,"authority":false}))
}
pub(crate) fn stage_exec(conn:&mut Connection,g:i64,id:&str,payload:&str,expected_sha:&str)->Result<Value,String>{
    require_stage(conn,g)?;object_payload(payload,id,"execSet")?;checked_hash(expected_sha)?;
    if sha_text(payload)!=expected_sha{return Err("Hash execSet no coincide.".into());}
    conn.execute(
      "INSERT INTO market_exec_native(generation,id,payload,sha256) VALUES(?1,?2,?3,?4)
       ON CONFLICT(generation,id) DO UPDATE SET payload=excluded.payload,sha256=excluded.sha256",
      params![g,id,payload,expected_sha]
    ).map_err(|e|format!("Staging execSet: {e}"))?;
    Ok(json!({"ok":true,"generation":g,"id":id,"authority":false}))
}
fn chunk_row(conn:&Connection,g:i64,id:&str,index:i64)->Result<Option<(i64,String,String)>,String>{
    conn.query_row(
      "SELECT row_count,payload,sha256 FROM market_tick_chunk_native
       WHERE generation=?1 AND dataset_id=?2 AND chunk_index=?3",
      params![g,id,index],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))
    ).optional().map_err(|e|format!("Lectura chunk Market Data: {e}"))
}
pub(crate) fn stage_tick_chunk(conn:&mut Connection,g:i64,id:&str,index:i64,payload:&str,expected_sha:&str)->Result<Value,String>{
    require_stage(conn,g)?;checked_id(id)?;checked_hash(expected_sha)?;
    if index<0{return Err("Índice de chunk negativo.".into());}
    let rows=tick_payload(payload)?;
    if sha_text(payload)!=expected_sha{return Err("Hash chunk ticks no coincide.".into());}
    if let Some((prior_rows,prior_payload,prior_sha))=chunk_row(conn,g,id,index)?{
        if prior_rows==rows.len() as i64&&prior_payload==payload&&prior_sha==expected_sha{
            return Ok(json!({"ok":true,"generation":g,"datasetId":id,"chunkIndex":index,"rows":rows.len(),"idempotent":true,"authority":false}));
        }
        return Err("Chunk ya existe con contenido distinto.".into());
    }
    let next:i64=conn.query_row(
      "SELECT COALESCE(MAX(chunk_index)+1,0) FROM market_tick_chunk_native WHERE generation=?1 AND dataset_id=?2",
      params![g,id],|r|r.get(0)
    ).map_err(|e|format!("Secuencia chunks Market Data: {e}"))?;
    if index!=next{return Err(format!("Chunk fuera de orden: esperado {next}, recibido {index}."));}
    conn.execute(
      "INSERT INTO market_tick_chunk_native(generation,dataset_id,chunk_index,row_count,payload,sha256)
       VALUES(?1,?2,?3,?4,?5,?6)",
      params![g,id,index,rows.len() as i64,payload,expected_sha]
    ).map_err(|e|format!("Staging chunk ticks: {e}"))?;
    Ok(json!({"ok":true,"generation":g,"datasetId":id,"chunkIndex":index,"rows":rows.len(),"idempotent":false,"authority":false}))
}
fn aggregate_from_rows(rows:&[(i64,i64,String)])->String{
    let mut material=String::new();
    for (index,count,hash) in rows{
        material.push_str(&format!("{index}:{count}:{hash}\n"));
    }
    sha_text(&material)
}
pub(crate) fn finalize_dataset(conn:&mut Connection,g:i64,id:&str,chunk_count:i64,row_count:i64,aggregate_sha:&str)->Result<Value,String>{
    require_stage(conn,g)?;checked_id(id)?;checked_hash(aggregate_sha)?;
    if chunk_count<=0{return Err("Dataset sin chunks.".into());}
    if row_count<=0||row_count as usize>MAX_DATASET_ROWS{return Err("Dataset supera el límite de 2.000.000 ticks o está vacío.".into());}
    let mut stmt=conn.prepare(
      "SELECT chunk_index,row_count,sha256,payload FROM market_tick_chunk_native
       WHERE generation=?1 AND dataset_id=?2 ORDER BY chunk_index"
    ).map_err(|e|format!("Consulta chunks Market Data: {e}"))?;
    let raw=stmt.query_map(params![g,id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?)))
      .map_err(|e|format!("Lectura chunks Market Data: {e}"))?;
    let mut info=Vec::new();let mut total=0i64;
    for (pos,row) in raw.enumerate(){
        let (idx,count,hash,payload)=row.map_err(|e|format!("Fila chunk Market Data: {e}"))?;
        if idx!=pos as i64{return Err("Chunks Market Data no contiguos.".into());}
        let parsed=tick_payload(&payload)?;
        if parsed.len() as i64!=count||sha_text(&payload)!=hash{return Err(format!("Chunk Market Data corrupto: {id}#{idx}"));}
        total+=count;info.push((idx,count,hash));
    }
    drop(stmt);
    if info.len() as i64!=chunk_count{return Err(format!("Número de chunks distinto: {} != {chunk_count}.",info.len()));}
    if total!=row_count{return Err(format!("Número de ticks distinto: {total} != {row_count}."));}
    let actual=aggregate_from_rows(&info);
    if actual!=aggregate_sha{return Err("Hash agregado del histórico no coincide.".into());}
    conn.execute(
      "INSERT INTO market_tick_catalog_native(generation,dataset_id,chunk_count,row_count,aggregate_sha256)
       VALUES(?1,?2,?3,?4,?5)
       ON CONFLICT(generation,dataset_id) DO UPDATE SET chunk_count=excluded.chunk_count,row_count=excluded.row_count,aggregate_sha256=excluded.aggregate_sha256",
      params![g,id,chunk_count,row_count,aggregate_sha]
    ).map_err(|e|format!("Catálogo histórico Market Data: {e}"))?;
    Ok(json!({"ok":true,"generation":g,"datasetId":id,"chunkCount":chunk_count,"rowCount":row_count,"aggregateSha256":aggregate_sha,"authority":false}))
}
pub(crate) fn read_chunk(conn:&Connection,g:i64,id:&str,index:i64)->Result<Value,String>{
    checked_id(id)?;
    let (rows,payload,hash)=chunk_row(conn,g,id,index)?.ok_or("Chunk Market Data no encontrado.")?;
    let parsed=tick_payload(&payload)?;
    if parsed.len() as i64!=rows||sha_text(&payload)!=hash{return Err("Chunk Market Data corrupto.".into());}
    Ok(json!({"generation":g,"datasetId":id,"chunkIndex":index,"rowCount":rows,"sha256":hash,"payload":payload,"authority":false}))
}
fn exact_inventory(conn:&Connection,table:&str,g:i64)->Result<Vec<(String,String)>,String>{
    let sql=format!("SELECT id,sha256 FROM {table} WHERE generation=?1 ORDER BY id");
    let mut stmt=conn.prepare(&sql).map_err(|e|format!("Inventario {table}: {e}"))?;
    let rows=stmt.query_map(params![g],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?)))
      .map_err(|e|format!("Filas inventario {table}: {e}"))?;
    rows.map(|x|x.map_err(|e|format!("Fila inventario {table}: {e}"))).collect()
}
fn parse_pairs(v:&Value,name:&str)->Result<Vec<(String,String)>,String>{
    let arr=v.as_array().ok_or_else(||format!("Inventario {name} debe ser array."))?;
    let mut out=Vec::new();let mut seen=HashSet::new();
    for x in arr{
        let id=x.get("id").and_then(Value::as_str).ok_or_else(||format!("{name}: id inválido."))?.to_owned();
        let hash=x.get("sha256").and_then(Value::as_str).ok_or_else(||format!("{name}: sha256 inválido."))?.to_owned();
        checked_id(&id)?;checked_hash(&hash)?;
        if !seen.insert(id.clone()){return Err(format!("{name}: id duplicado {id}."));}
        out.push((id,hash));
    }
    out.sort_by(|a,b|a.0.cmp(&b.0));Ok(out)
}
fn verify_stage_inventory(conn:&Connection,g:i64,inventory_json:&str)->Result<Value,String>{
    let v:Value=serde_json::from_str(inventory_json).map_err(|e|format!("Inventario Market Data JSON: {e}"))?;
    let meta_expected=parse_pairs(v.get("meta").unwrap_or(&Value::Null),"meta")?;
    let exec_expected=parse_pairs(v.get("exec").unwrap_or(&Value::Null),"exec")?;
    if exact_inventory(conn,"market_meta_native",g)?!=meta_expected{return Err("Inventario marketMeta nativo no coincide.".into());}
    if exact_inventory(conn,"market_exec_native",g)?!=exec_expected{return Err("Inventario execSets nativo no coincide.".into());}
    let datasets=v.get("ticks").and_then(Value::as_array).ok_or("Inventario ticks debe ser array.")?;
    let mut expected_ids=HashSet::new();
    for d in datasets{
        let id=d.get("id").and_then(Value::as_str).ok_or("ticks: id inválido.")?;
        if !expected_ids.insert(id.to_owned()){return Err(format!("ticks: id duplicado {id}."));}
        let rows=d.get("rowCount").and_then(Value::as_i64).ok_or("ticks: rowCount inválido.")?;
        let chunks=d.get("chunkCount").and_then(Value::as_i64).ok_or("ticks: chunkCount inválido.")?;
        let hash=d.get("aggregateSha256").and_then(Value::as_str).ok_or("ticks: aggregateSha256 inválido.")?;
        checked_hash(hash)?;
        let actual:Option<(i64,i64,String)>=conn.query_row(
          "SELECT chunk_count,row_count,aggregate_sha256 FROM market_tick_catalog_native WHERE generation=?1 AND dataset_id=?2",
          params![g,id],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))
        ).optional().map_err(|e|format!("Catálogo ticks verify: {e}"))?;
        if actual!=Some((chunks,rows,hash.to_owned())){return Err(format!("Catálogo ticks no coincide: {id}."));}
    }
    let catalog_ids:Vec<String>={
        let mut stmt=conn.prepare("SELECT dataset_id FROM market_tick_catalog_native WHERE generation=?1 ORDER BY dataset_id")
          .map_err(|e|format!("Inventario catálogos ticks: {e}"))?;
        let rows=stmt.query_map(params![g],|r|r.get::<_,String>(0)).map_err(|e|format!("Filas catálogo ticks: {e}"))?;
        rows.map(|x|x.map_err(|e|format!("Fila catálogo ticks: {e}"))).collect::<Result<Vec<_>,_>>()?
    };
    let mut expected_sorted:Vec<String>=expected_ids.into_iter().collect();expected_sorted.sort();
    if catalog_ids!=expected_sorted{return Err("Inventario de históricos nativos contiene faltantes o extras.".into());}

    let meta_ids:HashSet<String>=meta_expected.iter().map(|x|x.0.clone()).collect();
    if meta_ids!=expected_sorted.iter().cloned().collect(){return Err("marketMeta y marketTicks no forman pares exactos.".into());}
    for (id,_) in &exec_expected{
        let payload:String=conn.query_row("SELECT payload FROM market_exec_native WHERE generation=?1 AND id=?2",params![g,id],|r|r.get(0))
          .map_err(|e|format!("Lectura execSet {id}: {e}"))?;
        let obj:Value=serde_json::from_str(&payload).map_err(|e|format!("execSet {id} JSON: {e}"))?;
        if let Some(md)=obj.get("marketDatasetId").and_then(Value::as_str).filter(|x|!x.is_empty()){
            if !meta_ids.contains(md){return Err(format!("execSet {id} referencia histórico inexistente {md}."));}
        }
    }
    Ok(json!({"ok":true,"generation":g,"meta":meta_expected.len(),"datasets":datasets.len(),"execSets":exec_expected.len(),"authority":false}))
}
pub(crate) fn verify_stage(conn:&mut Connection,g:i64,inventory_json:&str)->Result<Value,String>{
    require_stage(conn,g)?;
    let verified=verify_stage_inventory(conn,g,inventory_json)?;
    let completed=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let inventory_sha=sha_text(inventory_json);
    conn.execute("UPDATE market_stage_state SET completed_at=?1,inventory_json=?2,inventory_sha256=?3 WHERE id=1 AND generation=?4",
      params![completed,inventory_json,inventory_sha,g]).map_err(|e|format!("Cierre staging Market Data: {e}"))?;
    let mut out=verified;out["completedAt"]=Value::String(completed);out["inventorySha256"]=Value::String(inventory_sha);Ok(out)
}

pub(crate) fn status(conn:&Connection)->Result<Value,String>{
    let active=active_generation(conn)?;
    let stage=stage_row(conn)?;
    Ok(json!({
      "active":active.is_some(),
      "generation":active,
      "staging":stage.as_ref().map(|x|json!({"generation":x.0,"completed":x.3.is_some()})),
      "maxChunkRows":MAX_CHUNK_ROWS,
      "maxDatasetRows":MAX_DATASET_ROWS
    }))
}


fn authority_marker_path(root:&Path)->PathBuf{root.join("native-market-authority.marker")}
fn ensure_authority_marker(root:&Path)->Result<(),String>{
    let final_path=authority_marker_path(root);
    if final_path.exists(){
        let meta=fs::metadata(&final_path).map_err(|e|format!("Marcador Market Data inaccesible: {e}"))?;
        if !meta.is_file()||meta.len()==0{return Err("Marcador de autoridad Market Data inválido.".into());}
        return Ok(());
    }
    let temp=root.join(".native-market-authority.marker.tmp");
    {
        let mut file=OpenOptions::new().create(true).write(true).truncate(true).open(&temp)
          .map_err(|e|format!("Creación marcador Market Data: {e}"))?;
        file.write_all(b"Trading Research Desktop: NATIVE MARKET DATA AUTHORITY; never fall back silently to IndexedDB\n")
          .map_err(|e|format!("Escritura marcador Market Data: {e}"))?;
        file.sync_all().map_err(|e|format!("fsync marcador Market Data: {e}"))?;
    }
    fs::rename(&temp,&final_path).map_err(|e|format!("Publicación marcador Market Data: {e}"))?;
    Ok(())
}
fn authority_row(conn:&Connection)->Result<Option<(i64,String,String,String,String)>,String>{
    conn.query_row(
      "SELECT generation,rollback_path,rollback_sha256,promoted_at,updated_at FROM market_authority_native WHERE id=1",
      [],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))
    ).optional().map_err(|e|format!("Autoridad Market Data: {e}"))
}
fn verify_record_table(conn:&Connection,table:&str,deep:bool)->Result<Vec<(String,String)>,String>{
    let sql=format!("SELECT id,payload,sha256 FROM {table} ORDER BY id");
    let mut stmt=conn.prepare(&sql).map_err(|e|format!("Verify {table}: {e}"))?;
    let rows=stmt.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?)))
      .map_err(|e|format!("Rows {table}: {e}"))?;
    let mut out=Vec::new();
    for row in rows{
        let (id,payload,hash)=row.map_err(|e|format!("Row {table}: {e}"))?;
        checked_id(&id)?;checked_hash(&hash)?;
        if deep{
            object_payload(&payload,&id,table)?;
            if sha_text(&payload)!=hash{return Err(format!("{table} corrupto: {id}."));}
        }
        out.push((id,hash));
    }
    Ok(out)
}
fn verify_active(conn:&Connection,deep:bool)->Result<Value,String>{
    let meta=verify_record_table(conn,"market_meta_active",deep)?;
    let exec=verify_record_table(conn,"market_exec_active",deep)?;
    let meta_ids:HashSet<String>=meta.iter().map(|x|x.0.clone()).collect();
    let mut stmt=conn.prepare("SELECT dataset_id,chunk_count,row_count,aggregate_sha256 FROM market_tick_catalog_active ORDER BY dataset_id")
      .map_err(|e|format!("Catálogo Market Data activo: {e}"))?;
    let cats=stmt.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?,r.get::<_,i64>(2)?,r.get::<_,String>(3)?)))
      .map_err(|e|format!("Filas catálogo Market Data activo: {e}"))?;
    let mut dataset_ids=HashSet::new();let mut total_rows=0i64;let mut dataset_count=0usize;
    for row in cats{
        let (id,chunks,rows,aggregate)=row.map_err(|e|format!("Fila catálogo Market Data activo: {e}"))?;
        checked_id(&id)?;checked_hash(&aggregate)?;
        if !dataset_ids.insert(id.clone()){return Err(format!("Histórico nativo duplicado: {id}."));}
        if chunks<=0||rows<=0||rows as usize>MAX_DATASET_ROWS{return Err(format!("Catálogo histórico inválido: {id}."));}
        {
            // Even shallow boot verification must prove that the catalog has a
            // complete contiguous chunk set. Deep mode additionally hashes and
            // parses payload bytes, which is intentionally deferred for large
            // histories until explicit verify/read.
            let mut q=conn.prepare("SELECT chunk_index,row_count,payload,sha256 FROM market_tick_chunk_active WHERE dataset_id=?1 ORDER BY chunk_index")
              .map_err(|e|format!("Chunks activos {id}: {e}"))?;
            let mapped=q.query_map(params![id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?)))
              .map_err(|e|format!("Filas chunks activos {id}: {e}"))?;
            let mut info=Vec::new();let mut count=0i64;
            for (pos,x) in mapped.enumerate(){
                let (idx,n,payload,hash)=x.map_err(|e|e.to_string())?;
                if idx!=pos as i64{return Err(format!("Chunks activos no contiguos: {id}."));}
                if n<=0||n as usize>MAX_CHUNK_ROWS{return Err(format!("Chunk activo fuera de límites: {id}#{idx}."));}
                checked_hash(&hash)?;
                if deep{
                    let parsed=tick_payload(&payload)?;
                    if parsed.len() as i64!=n||sha_text(&payload)!=hash{return Err(format!("Chunk activo corrupto: {id}#{idx}."));}
                }
                count+=n;info.push((idx,n,hash));
            }
            if info.len() as i64!=chunks||count!=rows||aggregate_from_rows(&info)!=aggregate{
                return Err(format!("Readback histórico nativo no coincide: {id}."));
            }
        }
        total_rows+=rows;dataset_count+=1;
    }
    if meta_ids!=dataset_ids{return Err("Autoridad Market Data: marketMeta y históricos no forman pares exactos.".into());}
    if deep{
        for (id,_) in &exec{
            let payload:String=conn.query_row("SELECT payload FROM market_exec_active WHERE id=?1",params![id],|r|r.get(0))
              .map_err(|e|format!("Readback execSet {id}: {e}"))?;
            let obj:Value=serde_json::from_str(&payload).map_err(|e|format!("execSet {id} JSON: {e}"))?;
            if let Some(md)=obj.get("marketDatasetId").and_then(Value::as_str).filter(|x|!x.is_empty()){
                if !meta_ids.contains(md){return Err(format!("execSet {id} referencia histórico inexistente {md}."));}
            }
        }
    }
    Ok(json!({"meta":meta.len(),"datasets":dataset_count,"execSets":exec.len(),"ticks":total_rows}))
}
pub(crate) fn authority_status(conn:&Connection,root:&Path,deep:bool)->Result<Value,String>{
    let row=authority_row(conn)?;
    if row.is_none()&&authority_marker_path(root).exists(){
        return Err("Existe marcador de autoridad Market Data, pero falta su registro SQLite. Recuperación obligatoria.".into());
    }
    if let Some((generation,rollback_path,rollback_sha,promoted_at,updated_at))=row{
        ensure_authority_marker(root)?;
        let verified=verify_active(conn,deep)?;
        return Ok(json!({"ok":true,"active":true,"generation":generation,"rollbackPath":rollback_path,
          "rollbackSha256":rollback_sha,"promotedAt":promoted_at,"updatedAt":updated_at,
          "meta":verified["meta"],"datasets":verified["datasets"],"execSets":verified["execSets"],
          "ticks":verified["ticks"],"deepVerified":deep,"maxChunkRows":MAX_CHUNK_ROWS,"maxDatasetRows":MAX_DATASET_ROWS}));
    }
    Ok(json!({"ok":true,"active":false,"generation":0,"meta":0,"datasets":0,"execSets":0,"ticks":0,
      "deepVerified":deep,"maxChunkRows":MAX_CHUNK_ROWS,"maxDatasetRows":MAX_DATASET_ROWS}))
}
pub(crate) fn promote(conn:&mut Connection,root:&Path,stage_generation:i64,rollback_path:&str,rollback_sha:&str)->Result<Value,String>{
    checked_hash(rollback_sha)?;
    if let Some((generation,prior_path,prior_sha,promoted_at,_))=authority_row(conn)?{
        if prior_path!=rollback_path||prior_sha!=rollback_sha{return Err("Market Data ya fue promovido con otro rollback; no se re-promueve.".into());}
        ensure_authority_marker(root)?;
        let verified=verify_active(conn,true)?;
        return Ok(json!({"ok":true,"active":true,"generation":generation,"idempotent":true,
          "promotedAt":promoted_at,"meta":verified["meta"],"datasets":verified["datasets"],"execSets":verified["execSets"],"ticks":verified["ticks"]}));
    }
    let stage=stage_row(conn)?.ok_or("No existe staging Market Data para promover.")?;
    if stage.0!=stage_generation||stage.1!=rollback_path||stage.2!=rollback_sha||stage.3.is_none(){
        return Err("Staging Market Data incompleto o no coincide con el rollback que se intenta promover.".into());
    }
    let stored:Option<(String,String)>=conn.query_row(
      "SELECT inventory_json,inventory_sha256 FROM market_stage_state WHERE id=1 AND generation=?1",
      params![stage_generation],|r|Ok((r.get(0)?,r.get(1)?))
    ).optional().map_err(|e|format!("Inventario staging para promoción: {e}"))?;
    let (inventory,inventory_sha)=stored.ok_or("Staging Market Data cerrado sin inventario certificado.")?;
    if sha_text(&inventory)!=inventory_sha{return Err("Inventario staging Market Data alterado.".into());}
    verify_stage_inventory(conn,stage_generation,&inventory)?;
    ensure_authority_marker(root)?;
    let now=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Transacción promoción Market Data: {e}"))?;
    tx.execute_batch("DELETE FROM market_meta_active;DELETE FROM market_exec_active;DELETE FROM market_tick_chunk_active;DELETE FROM market_tick_catalog_active;")
      .map_err(|e|format!("Limpieza autoridad Market Data: {e}"))?;
    tx.execute("INSERT INTO market_meta_active(id,payload,sha256) SELECT id,payload,sha256 FROM market_meta_native WHERE generation=?1",params![stage_generation]).map_err(|e|e.to_string())?;
    tx.execute("INSERT INTO market_exec_active(id,payload,sha256) SELECT id,payload,sha256 FROM market_exec_native WHERE generation=?1",params![stage_generation]).map_err(|e|e.to_string())?;
    tx.execute("INSERT INTO market_tick_chunk_active(dataset_id,chunk_index,row_count,payload,sha256) SELECT dataset_id,chunk_index,row_count,payload,sha256 FROM market_tick_chunk_native WHERE generation=?1",params![stage_generation]).map_err(|e|e.to_string())?;
    tx.execute("INSERT INTO market_tick_catalog_active(dataset_id,chunk_count,row_count,aggregate_sha256) SELECT dataset_id,chunk_count,row_count,aggregate_sha256 FROM market_tick_catalog_native WHERE generation=?1",params![stage_generation]).map_err(|e|e.to_string())?;
    tx.execute("INSERT INTO market_authority_native(id,generation,rollback_path,rollback_sha256,promoted_at,updated_at) VALUES(1,1,?1,?2,?3,?3)",
      params![rollback_path,rollback_sha,now]).map_err(|e|format!("Registro autoridad Market Data: {e}"))?;
    tx.commit().map_err(|e|format!("Commit promoción Market Data: {e}"))?;
    let verified=verify_active(conn,true)?;
    Ok(json!({"ok":true,"active":true,"generation":1,"idempotent":false,"promotedAt":now,
      "meta":verified["meta"],"datasets":verified["datasets"],"execSets":verified["execSets"],"ticks":verified["ticks"]}))
}
pub(crate) fn list_records(conn:&Connection,store:&str)->Result<Value,String>{
    if authority_row(conn)?.is_none(){return Err("Autoridad Market Data nativa no activa.".into());}
    let table=match store{"marketMeta"=>"market_meta_active","execSets"=>"market_exec_active",_=>return Err("Store nativo no enumerable como registro.".into())};
    let mut stmt=conn.prepare(&format!("SELECT payload FROM {table} ORDER BY id")).map_err(|e|e.to_string())?;
    let rows=stmt.query_map([],|r|r.get::<_,String>(0)).map_err(|e|e.to_string())?;
    let mut out=Vec::new();
    for row in rows{out.push(serde_json::from_str::<Value>(&row.map_err(|e|e.to_string())?).map_err(|e|e.to_string())?);}
    Ok(Value::Array(out))
}
pub(crate) fn get_record(conn:&Connection,store:&str,id:&str)->Result<Option<Value>,String>{
    if authority_row(conn)?.is_none(){return Err("Autoridad Market Data nativa no activa.".into());}
    checked_id(id)?;
    let table=match store{"marketMeta"=>"market_meta_active","execSets"=>"market_exec_active",_=>return Err("Store nativo no compatible.".into())};
    let payload:Option<String>=conn.query_row(&format!("SELECT payload FROM {table} WHERE id=?1"),params![id],|r|r.get(0)).optional().map_err(|e|e.to_string())?;
    payload.map(|p|serde_json::from_str(&p).map_err(|e|format!("Registro Market Data corrupto: {e}"))).transpose()
}
pub(crate) fn list_catalogs(conn:&Connection)->Result<Value,String>{
    if authority_row(conn)?.is_none(){return Err("Autoridad Market Data nativa no activa.".into());}
    let mut stmt=conn.prepare("SELECT dataset_id,chunk_count,row_count,aggregate_sha256 FROM market_tick_catalog_active ORDER BY dataset_id").map_err(|e|e.to_string())?;
    let rows=stmt.query_map([],|r|Ok(json!({"id":r.get::<_,String>(0)?,"chunkCount":r.get::<_,i64>(1)?,"rowCount":r.get::<_,i64>(2)?,"aggregateSha256":r.get::<_,String>(3)?}))).map_err(|e|e.to_string())?;
    Ok(Value::Array(rows.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?))
}
pub(crate) fn read_active_chunk(conn:&Connection,id:&str,index:i64)->Result<Value,String>{
    if authority_row(conn)?.is_none(){return Err("Autoridad Market Data nativa no activa.".into());}
    checked_id(id)?;
    let row:Option<(i64,String,String)>=conn.query_row(
      "SELECT row_count,payload,sha256 FROM market_tick_chunk_active WHERE dataset_id=?1 AND chunk_index=?2",
      params![id,index],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))
    ).optional().map_err(|e|e.to_string())?;
    let (count,payload,hash)=row.ok_or("Chunk Market Data activo no encontrado.")?;
    let parsed=tick_payload(&payload)?;
    if parsed.len() as i64!=count||sha_text(&payload)!=hash{return Err("Chunk Market Data activo corrupto.".into());}
    Ok(json!({"id":id,"chunkIndex":index,"rowCount":count,"sha256":hash,"payload":payload,"authority":true}))
}
fn pending_op(conn:&Connection,op:&str)->Result<(i64,String),String>{
    checked_id(op)?;
    conn.query_row("SELECT expected_generation,reason FROM market_pending_op WHERE op_id=?1",params![op],|r|Ok((r.get(0)?,r.get(1)?)))
      .optional().map_err(|e|e.to_string())?.ok_or("Operación Market Data pendiente inexistente.".into())
}
pub(crate) fn begin_live_op(conn:&mut Connection,op:&str,expected_generation:i64,reason:&str)->Result<Value,String>{
    checked_id(op)?;
    if reason.is_empty()||reason.len()>160{return Err("Razón Market Data inválida.".into());}
    let current=authority_row(conn)?.ok_or("Autoridad Market Data no activa.")?.0;
    if current!=expected_generation{return Err(format!("Conflicto generación Market Data: esperado {expected_generation}, actual {current}."));}
    let at=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|e.to_string())?;
    for table in ["market_pending_record","market_pending_delete","market_pending_tick_chunk","market_pending_tick_catalog"]{
        tx.execute(&format!("DELETE FROM {table} WHERE op_id=?1"),params![op]).map_err(|e|e.to_string())?;
    }
    tx.execute("INSERT INTO market_pending_op(op_id,expected_generation,reason,created_at) VALUES(?1,?2,?3,?4)
      ON CONFLICT(op_id) DO UPDATE SET expected_generation=excluded.expected_generation,reason=excluded.reason,created_at=excluded.created_at",
      params![op,expected_generation,reason,at]).map_err(|e|e.to_string())?;
    tx.commit().map_err(|e|e.to_string())?;
    Ok(json!({"ok":true,"opId":op,"expectedGeneration":expected_generation}))
}
pub(crate) fn stage_live_record(conn:&mut Connection,op:&str,store:&str,id:&str,payload:&str,hash:&str)->Result<Value,String>{
    pending_op(conn,op)?;checked_id(id)?;checked_hash(hash)?;
    if !matches!(store,"marketMeta"|"execSets"){return Err("Store record Market Data inválido.".into());}
    object_payload(payload,id,store)?;
    if sha_text(payload)!=hash{return Err(format!("Hash {store} no coincide."));}
    conn.execute("INSERT INTO market_pending_record(op_id,store,id,payload,sha256) VALUES(?1,?2,?3,?4,?5)
      ON CONFLICT(op_id,store,id) DO UPDATE SET payload=excluded.payload,sha256=excluded.sha256",
      params![op,store,id,payload,hash]).map_err(|e|e.to_string())?;
    Ok(json!({"ok":true,"opId":op,"store":store,"id":id}))
}
pub(crate) fn stage_live_delete(conn:&mut Connection,op:&str,store:&str,id:&str)->Result<Value,String>{
    pending_op(conn,op)?;checked_id(id)?;
    if !matches!(store,"marketMeta"|"marketTicks"|"execSets"){return Err("Store delete Market Data inválido.".into());}
    conn.execute("INSERT OR IGNORE INTO market_pending_delete(op_id,store,id) VALUES(?1,?2,?3)",params![op,store,id]).map_err(|e|e.to_string())?;
    Ok(json!({"ok":true,"opId":op,"store":store,"id":id}))
}
pub(crate) fn stage_live_tick_chunk(conn:&mut Connection,op:&str,id:&str,index:i64,payload:&str,hash:&str)->Result<Value,String>{
    pending_op(conn,op)?;checked_id(id)?;checked_hash(hash)?;
    if index<0{return Err("Índice chunk live negativo.".into());}
    let rows=tick_payload(payload)?;
    if sha_text(payload)!=hash{return Err("Hash chunk live no coincide.".into());}
    let prior:Option<(i64,String,String)>=conn.query_row(
      "SELECT row_count,payload,sha256 FROM market_pending_tick_chunk WHERE op_id=?1 AND dataset_id=?2 AND chunk_index=?3",
      params![op,id,index],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?))).optional().map_err(|e|e.to_string())?;
    if let Some((n,p,h))=prior{
        if n==rows.len() as i64&&p==payload&&h==hash{return Ok(json!({"ok":true,"idempotent":true,"rows":n}));}
        return Err("Chunk live repetido con contenido distinto.".into());
    }
    let next:i64=conn.query_row("SELECT COALESCE(MAX(chunk_index)+1,0) FROM market_pending_tick_chunk WHERE op_id=?1 AND dataset_id=?2",
      params![op,id],|r|r.get(0)).map_err(|e|e.to_string())?;
    if index!=next{return Err(format!("Chunk live fuera de orden: esperado {next}, recibido {index}."));}
    conn.execute("INSERT INTO market_pending_tick_chunk(op_id,dataset_id,chunk_index,row_count,payload,sha256) VALUES(?1,?2,?3,?4,?5,?6)",
      params![op,id,index,rows.len() as i64,payload,hash]).map_err(|e|e.to_string())?;
    Ok(json!({"ok":true,"idempotent":false,"rows":rows.len()}))
}
pub(crate) fn finalize_live_tick(conn:&mut Connection,op:&str,id:&str,chunk_count:i64,row_count:i64,aggregate:&str)->Result<Value,String>{
    pending_op(conn,op)?;checked_id(id)?;checked_hash(aggregate)?;
    if chunk_count<=0||row_count<=0||row_count as usize>MAX_DATASET_ROWS{return Err("Catálogo live inválido.".into());}
    let mut stmt=conn.prepare("SELECT chunk_index,row_count,sha256,payload FROM market_pending_tick_chunk WHERE op_id=?1 AND dataset_id=?2 ORDER BY chunk_index").map_err(|e|e.to_string())?;
    let rows=stmt.query_map(params![op,id],|r|Ok((r.get::<_,i64>(0)?,r.get::<_,i64>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?))).map_err(|e|e.to_string())?;
    let mut info=Vec::new();let mut total=0i64;
    for (pos,row) in rows.enumerate(){
        let (idx,n,h,p)=row.map_err(|e|e.to_string())?;
        if idx!=pos as i64{return Err("Chunks live no contiguos.".into());}
        let parsed=tick_payload(&p)?;
        if parsed.len() as i64!=n||sha_text(&p)!=h{return Err("Chunk live corrupto.".into());}
        total+=n;info.push((idx,n,h));
    }
    drop(stmt);
    if info.len() as i64!=chunk_count||total!=row_count||aggregate_from_rows(&info)!=aggregate{return Err("Catálogo live no coincide con sus chunks.".into());}
    conn.execute("INSERT INTO market_pending_tick_catalog(op_id,dataset_id,chunk_count,row_count,aggregate_sha256) VALUES(?1,?2,?3,?4,?5)
      ON CONFLICT(op_id,dataset_id) DO UPDATE SET chunk_count=excluded.chunk_count,row_count=excluded.row_count,aggregate_sha256=excluded.aggregate_sha256",
      params![op,id,chunk_count,row_count,aggregate]).map_err(|e|e.to_string())?;
    Ok(json!({"ok":true,"opId":op,"datasetId":id,"rowCount":row_count,"chunkCount":chunk_count}))
}
fn validate_active_relations_tx(tx:&rusqlite::Transaction<'_>)->Result<(),String>{
    let meta:HashSet<String>={
        let mut s=tx.prepare("SELECT id FROM market_meta_active").map_err(|e|e.to_string())?;
        s.query_map([],|r|r.get::<_,String>(0)).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?.into_iter().collect()
    };
    let ticks:HashSet<String>={
        let mut s=tx.prepare("SELECT dataset_id FROM market_tick_catalog_active").map_err(|e|e.to_string())?;
        s.query_map([],|r|r.get::<_,String>(0)).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?.into_iter().collect()
    };
    if meta!=ticks{return Err("Commit Market Data rompería la paridad marketMeta/marketTicks.".into());}
    let payloads:Vec<(String,String)>={
        let mut s=tx.prepare("SELECT id,payload FROM market_exec_active").map_err(|e|e.to_string())?;
        s.query_map([],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(|e|e.to_string())?.collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?
    };
    for (id,p) in payloads{
        let v:Value=serde_json::from_str(&p).map_err(|e|format!("execSet {id}: {e}"))?;
        if let Some(md)=v.get("marketDatasetId").and_then(Value::as_str).filter(|x|!x.is_empty()){
            if !meta.contains(md){return Err(format!("Commit Market Data dejaría execSet {id} huérfano de {md}."));}
        }
    }
    Ok(())
}
pub(crate) fn abort_live_op(conn:&mut Connection,op:&str)->Result<Value,String>{
    checked_id(op)?;
    let tx=conn.transaction().map_err(|e|format!("Abort Market Data: {e}"))?;
    for table in ["market_pending_record","market_pending_delete","market_pending_tick_chunk","market_pending_tick_catalog","market_pending_op"]{
        tx.execute(&format!("DELETE FROM {table} WHERE op_id=?1"),params![op]).map_err(|e|e.to_string())?;
    }
    tx.commit().map_err(|e|format!("Commit abort Market Data: {e}"))?;
    Ok(json!({"ok":true,"opId":op,"aborted":true}))
}

pub(crate) fn commit_live_op(conn:&mut Connection,op:&str)->Result<Value,String>{
    let (expected,reason)=pending_op(conn,op)?;
    let now=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    let tx=conn.transaction().map_err(|e|format!("Transacción live Market Data: {e}"))?;
    let current:i64=tx.query_row("SELECT generation FROM market_authority_native WHERE id=1",[],|r|r.get(0))
      .map_err(|_|"Autoridad Market Data no activa.".to_string())?;
    if current!=expected{return Err(format!("Conflicto generación Market Data: esperado {expected}, actual {current}."));}
    {
        let mut s=tx.prepare("SELECT store,id FROM market_pending_delete WHERE op_id=?1").map_err(|e|e.to_string())?;
        let rows=s.query_map(params![op],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?))).map_err(|e|e.to_string())?
          .collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
        for (store,id) in rows{
            match store.as_str(){
              "marketMeta"=>{tx.execute("DELETE FROM market_meta_active WHERE id=?1",params![id]).map_err(|e|e.to_string())?;},
              "execSets"=>{tx.execute("DELETE FROM market_exec_active WHERE id=?1",params![id]).map_err(|e|e.to_string())?;},
              "marketTicks"=>{tx.execute("DELETE FROM market_tick_chunk_active WHERE dataset_id=?1",params![id]).map_err(|e|e.to_string())?;tx.execute("DELETE FROM market_tick_catalog_active WHERE dataset_id=?1",params![id]).map_err(|e|e.to_string())?;},
              _=>return Err("Delete store pendiente inválido.".into())
            }
        }
    }
    {
        let mut s=tx.prepare("SELECT store,id,payload,sha256 FROM market_pending_record WHERE op_id=?1").map_err(|e|e.to_string())?;
        let rows=s.query_map(params![op],|r|Ok((r.get::<_,String>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?))).map_err(|e|e.to_string())?
          .collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
        for (store,id,payload,hash) in rows{
            let table=if store=="marketMeta"{"market_meta_active"}else if store=="execSets"{"market_exec_active"}else{return Err("Put store pendiente inválido.".into())};
            tx.execute(&format!("INSERT INTO {table}(id,payload,sha256) VALUES(?1,?2,?3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,sha256=excluded.sha256"),
              params![id,payload,hash]).map_err(|e|e.to_string())?;
        }
    }
    {
        let mut s=tx.prepare("SELECT dataset_id,chunk_count,row_count,aggregate_sha256 FROM market_pending_tick_catalog WHERE op_id=?1").map_err(|e|e.to_string())?;
        let cats=s.query_map(params![op],|r|Ok((r.get::<_,String>(0)?,r.get::<_,i64>(1)?,r.get::<_,i64>(2)?,r.get::<_,String>(3)?))).map_err(|e|e.to_string())?
          .collect::<Result<Vec<_>,_>>().map_err(|e|e.to_string())?;
        for (id,chunks,rows,aggregate) in cats{
            tx.execute("DELETE FROM market_tick_chunk_active WHERE dataset_id=?1",params![id]).map_err(|e|e.to_string())?;
            tx.execute("DELETE FROM market_tick_catalog_active WHERE dataset_id=?1",params![id]).map_err(|e|e.to_string())?;
            tx.execute("INSERT INTO market_tick_chunk_active(dataset_id,chunk_index,row_count,payload,sha256)
              SELECT dataset_id,chunk_index,row_count,payload,sha256 FROM market_pending_tick_chunk WHERE op_id=?1 AND dataset_id=?2",
              params![op,id]).map_err(|e|e.to_string())?;
            tx.execute("INSERT INTO market_tick_catalog_active(dataset_id,chunk_count,row_count,aggregate_sha256) VALUES(?1,?2,?3,?4)",
              params![id,chunks,rows,aggregate]).map_err(|e|e.to_string())?;
        }
    }
    validate_active_relations_tx(&tx)?;
    let next=current+1;
    tx.execute("UPDATE market_authority_native SET generation=?1,updated_at=?2 WHERE id=1",params![next,now]).map_err(|e|e.to_string())?;
    for table in ["market_pending_record","market_pending_delete","market_pending_tick_chunk","market_pending_tick_catalog","market_pending_op"]{
        tx.execute(&format!("DELETE FROM {table} WHERE op_id=?1"),params![op]).map_err(|e|e.to_string())?;
    }
    tx.commit().map_err(|e|format!("Commit live Market Data: {e}"))?;
    Ok(json!({"ok":true,"generation":next,"reason":reason,"updatedAt":now}))
}

#[cfg(test)]
mod tests{
    use super::*;
    use std::fs;

    fn hash(s:&str)->String{sha_text(s)}
    fn obj(id:&str,extra:&str)->String{format!(r#"{{"id":"{id}","x":"{extra}"}}"#)}
    fn ticks(n:usize,start:i64)->String{
        let rows=(0..n).map(|i|json!([start+i as i64,0,1.0,0.9,1.1,1])).collect::<Vec<_>>();
        serde_json::to_string(&rows).unwrap()
    }
    fn agg(chunks:&[(i64,i64,String)])->String{aggregate_from_rows(chunks)}
    fn begin(c:&mut Connection)->i64{
        begin_stage(c,"C:\\\\backups\\\\safe.trbackup",&"a".repeat(64)).unwrap()["generation"].as_i64().unwrap()
    }

    #[test]
    fn chunk_roundtrip_sequence_and_hash(){
        let mut c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();let g=begin(&mut c);
        let p0=ticks(2,1);let h0=hash(&p0);
        assert!(stage_tick_chunk(&mut c,g,"MD1",1,&p0,&h0).is_err());
        assert_eq!(stage_tick_chunk(&mut c,g,"MD1",0,&p0,&h0).unwrap()["rows"],2);
        assert_eq!(stage_tick_chunk(&mut c,g,"MD1",0,&p0,&h0).unwrap()["idempotent"],true);
        let p1=ticks(1,3);let h1=hash(&p1);
        stage_tick_chunk(&mut c,g,"MD1",1,&p1,&h1).unwrap();
        let a=agg(&[(0,2,h0.clone()),(1,1,h1.clone())]);
        finalize_dataset(&mut c,g,"MD1",2,3,&a).unwrap();
        let out=read_chunk(&c,g,"MD1",1).unwrap();
        assert_eq!(out["rowCount"],1);assert_eq!(out["payload"],p1);
        assert!(stage_tick_chunk(&mut c,g,"MD1",1,&ticks(1,99),&hash(&ticks(1,99))).is_err());
    }

    #[test]
    fn rejects_oversize_bad_hash_and_bad_rows(){
        let mut c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();let g=begin(&mut c);
        let too_many=serde_json::to_string(&(0..=MAX_CHUNK_ROWS).map(|i|json!([i,0,1,1,1,1])).collect::<Vec<_>>()).unwrap();
        assert!(stage_tick_chunk(&mut c,g,"MD",0,&too_many,&hash(&too_many)).is_err());
        let p=ticks(1,0);
        assert!(stage_tick_chunk(&mut c,g,"MD",0,&p,&"b".repeat(64)).is_err());
        let bad=r#"[[1,2,3]]"#;
        assert!(stage_tick_chunk(&mut c,g,"MD",0,bad,&hash(bad)).is_err());
    }

    #[test]
    fn exact_inventory_pairs_and_exec_reference(){
        let mut c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();let g=begin(&mut c);
        let m=obj("MD1","meta");let mh=hash(&m);stage_meta(&mut c,g,"MD1",&m,&mh).unwrap();
        let p=ticks(2,0);let ph=hash(&p);stage_tick_chunk(&mut c,g,"MD1",0,&p,&ph).unwrap();
        let a=agg(&[(0,2,ph)]);finalize_dataset(&mut c,g,"MD1",1,2,&a).unwrap();
        let e=r#"{"id":"EX1","marketDatasetId":"MD1"}"#.to_string();let eh=hash(&e);stage_exec(&mut c,g,"EX1",&e,&eh).unwrap();
        let inv=json!({"meta":[{"id":"MD1","sha256":mh}],"ticks":[{"id":"MD1","rowCount":2,"chunkCount":1,"aggregateSha256":a}],"exec":[{"id":"EX1","sha256":eh}]}).to_string();
        let ok=verify_stage(&mut c,g,&inv).unwrap();assert_eq!(ok["datasets"],1);
        assert!(stage_meta(&mut c,g,"MD2",&obj("MD2","x"),&hash(&obj("MD2","x"))).is_err(),"closed staging must reject writes");
    }

    #[test]
    fn corruption_is_detected(){
        let mut c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();let g=begin(&mut c);
        let p=ticks(2,0);let h=hash(&p);stage_tick_chunk(&mut c,g,"MD1",0,&p,&h).unwrap();
        c.execute("UPDATE market_tick_chunk_native SET payload='[[1,0,9,9,9,9]]' WHERE generation=?1 AND dataset_id='MD1'",params![g]).unwrap();
        assert!(read_chunk(&c,g,"MD1",0).is_err());
    }

    #[test]
    fn stage_resumes_and_real_sqlite_reopens(){
        let path=std::env::temp_dir().join(format!("tr-b78-{}-{}.sqlite3",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        let g;
        {
            let mut c=Connection::open(&path).unwrap();prepare_schema(&c).unwrap();
            let x=begin_stage(&mut c,"rollback.trbackup",&"c".repeat(64)).unwrap();g=x["generation"].as_i64().unwrap();
            let y=begin_stage(&mut c,"rollback.trbackup",&"c".repeat(64)).unwrap();assert_eq!(y["resumed"],true);
            let m=obj("MD1","r");stage_meta(&mut c,g,"MD1",&m,&hash(&m)).unwrap();
        }
        {
            let c=Connection::open(&path).unwrap();prepare_schema(&c).unwrap();
            assert_eq!(status(&c).unwrap()["staging"]["generation"],g);
            assert_eq!(exact_inventory(&c,"market_meta_native",g).unwrap().len(),1);
        }
        let _=fs::remove_file(path);
    }

    fn stage_complete_one(c:&mut Connection)->(i64,String){
        let g=begin(c);
        let m=obj("MD1","meta");let mh=hash(&m);stage_meta(c,g,"MD1",&m,&mh).unwrap();
        let p=ticks(2,0);let ph=hash(&p);stage_tick_chunk(c,g,"MD1",0,&p,&ph).unwrap();
        let a=agg(&[(0,2,ph)]);finalize_dataset(c,g,"MD1",1,2,&a).unwrap();
        let e=r#"{"id":"EX1","marketDatasetId":"MD1"}"#.to_string();let eh=hash(&e);stage_exec(c,g,"EX1",&e,&eh).unwrap();
        let inv=json!({"meta":[{"id":"MD1","sha256":mh}],"ticks":[{"id":"MD1","rowCount":2,"chunkCount":1,"aggregateSha256":a}],"exec":[{"id":"EX1","sha256":eh}]}).to_string();
        verify_stage(c,g,&inv).unwrap();(g,inv)
    }

    #[test]
    fn promotion_is_bound_to_certified_inventory_and_marker(){
        let root=std::env::temp_dir().join(format!("tr-b78-promote-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&root).unwrap();
        let mut c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();
        let (g,_inv)=stage_complete_one(&mut c);
        let out=promote(&mut c,&root,g,"C:\\backups\\safe.trbackup",&"a".repeat(64)).unwrap();
        assert_eq!(out["generation"],1);assert_eq!(out["datasets"],1);assert!(authority_marker_path(&root).exists());
        let st=authority_status(&c,&root,true).unwrap();
        assert_eq!(st["active"],true);assert_eq!(st["meta"],1);assert_eq!(st["execSets"],1);assert_eq!(st["ticks"],2);
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn promotion_rechecks_staging_after_certification(){
        let root=std::env::temp_dir().join(format!("tr-b78-tamper-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&root).unwrap();
        let mut c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();
        let (g,_inv)=stage_complete_one(&mut c);
        c.execute("UPDATE market_tick_chunk_native SET payload='[[9,0,9,9,9,9]]' WHERE generation=?1 AND dataset_id='MD1'",params![g]).unwrap();
        assert!(promote(&mut c,&root,g,"C:\\backups\\safe.trbackup",&"a".repeat(64)).is_err());
        assert!(authority_row(&c).unwrap().is_none());
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn live_cas_commit_is_atomic_and_relation_safe(){
        let root=std::env::temp_dir().join(format!("tr-b78-live-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&root).unwrap();
        let mut c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();
        let (g,_)=stage_complete_one(&mut c);
        promote(&mut c,&root,g,"C:\\backups\\safe.trbackup",&"a".repeat(64)).unwrap();

        begin_live_op(&mut c,"OP1",1,"replace history").unwrap();
        let meta=obj("MD1","new");stage_live_record(&mut c,"OP1","marketMeta","MD1",&meta,&hash(&meta)).unwrap();
        let p=ticks(3,10);let ph=hash(&p);stage_live_tick_chunk(&mut c,"OP1","MD1",0,&p,&ph).unwrap();
        let a=agg(&[(0,3,ph)]);finalize_live_tick(&mut c,"OP1","MD1",1,3,&a).unwrap();
        let commit=commit_live_op(&mut c,"OP1").unwrap();assert_eq!(commit["generation"],2);
        assert_eq!(authority_status(&c,&root,true).unwrap()["ticks"],3);
        assert!(begin_live_op(&mut c,"STALE",1,"stale").is_err());

        begin_live_op(&mut c,"BAD",2,"orphan").unwrap();
        stage_live_delete(&mut c,"BAD","marketMeta","MD1").unwrap();
        assert!(commit_live_op(&mut c,"BAD").is_err());
        assert!(get_record(&c,"marketMeta","MD1").unwrap().is_some());
        assert_eq!(authority_status(&c,&root,false).unwrap()["generation"],2);
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn marker_without_market_authority_is_fatal(){
        let root=std::env::temp_dir().join(format!("tr-b78-marker-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&root).unwrap();
        let c=Connection::open_in_memory().unwrap();prepare_schema(&c).unwrap();
        ensure_authority_marker(&root).unwrap();
        assert!(authority_status(&c,&root,false).is_err());
        let _=fs::remove_dir_all(root);
    }

    #[test]
    fn active_authority_survives_real_sqlite_reopen(){
        let root=std::env::temp_dir().join(format!("tr-b78-reopen-active-{}-{}",std::process::id(),Utc::now().timestamp_nanos_opt().unwrap_or(0)));
        fs::create_dir_all(&root).unwrap();let db=root.join("market.sqlite");
        {
            let mut c=Connection::open(&db).unwrap();prepare_schema(&c).unwrap();
            let (g,_)=stage_complete_one(&mut c);
            promote(&mut c,&root,g,"C:\\backups\\safe.trbackup",&"a".repeat(64)).unwrap();
        }
        {
            let c=Connection::open(&db).unwrap();prepare_schema(&c).unwrap();
            let st=authority_status(&c,&root,true).unwrap();
            assert_eq!(st["active"],true);assert_eq!(st["generation"],1);assert_eq!(st["ticks"],2);
            assert_eq!(list_catalogs(&c).unwrap().as_array().unwrap().len(),1);
        }
        let _=fs::remove_dir_all(root);
    }
}
