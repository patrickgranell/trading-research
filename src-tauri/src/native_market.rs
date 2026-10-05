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

pub(crate) const MAX_CHUNK_ROWS: usize = 25_000;
pub(crate) const MAX_DATASET_ROWS: usize = 2_000_000;

const SCHEMA:&str=r#"
CREATE TABLE IF NOT EXISTS market_stage_state (
  id INTEGER PRIMARY KEY CHECK(id=1),
  generation INTEGER NOT NULL CHECK(generation>=1),
  rollback_path TEXT NOT NULL,
  rollback_sha256 TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT
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
      "INSERT INTO market_stage_state(id,generation,rollback_path,rollback_sha256,started_at,completed_at)
       VALUES(1,?1,?2,?3,?4,NULL)
       ON CONFLICT(id) DO UPDATE SET generation=excluded.generation,rollback_path=excluded.rollback_path,
         rollback_sha256=excluded.rollback_sha256,started_at=excluded.started_at,completed_at=NULL",
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
pub(crate) fn verify_stage(conn:&mut Connection,g:i64,inventory_json:&str)->Result<Value,String>{
    require_stage(conn,g)?;
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
    let completed=Utc::now().to_rfc3339_opts(SecondsFormat::Millis,true);
    conn.execute("UPDATE market_stage_state SET completed_at=?1 WHERE id=1 AND generation=?2",params![completed,g])
      .map_err(|e|format!("Cierre staging Market Data: {e}"))?;
    Ok(json!({"ok":true,"generation":g,"meta":meta_expected.len(),"datasets":datasets.len(),"execSets":exec_expected.len(),"completedAt":completed,"authority":false}))
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
}
