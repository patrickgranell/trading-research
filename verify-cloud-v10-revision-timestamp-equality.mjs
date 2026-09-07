import fs from 'node:fs';

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};
const migrationPath='supabase/migrations/20260907234000_v31_25_cloud_v10_revision_timestamp_equality.sql';

need(fs.existsSync(migrationPath),'Batch 64 RED: falta migración correctiva para igualdad semántica de revisiones Cloud V10.');

if(fs.existsSync(migrationPath)){
  const sql=fs.readFileSync(migrationPath,'utf8');
  need(/create\s+or\s+replace\s+function\s+public\.apply_trading_workspace/i.test(sql),
    'Batch 64: la migración no redefine apply_trading_workspace().');
  need(/v_expected_revision\s+timestamptz/i.test(sql),
    'Batch 64: la revisión esperada no se normaliza a timestamptz.');
  need(/nullif\s*\(\s*p_expected_revision\s*,\s*''\s*\)\s*::\s*timestamptz/i.test(sql),
    'Batch 64: p_expected_revision no se convierte semánticamente a timestamptz.');
  need(/v_current_revision\s*<>\s*v_expected_revision/i.test(sql),
    'Batch 64: el CAS no compara timestamptz con timestamptz.');
  need(!/v_current_revision\s*::\s*text\s*<>\s*v_expected/i.test(sql),
    'Batch 64: persiste la comparación textual defectuosa de revisiones.');
  need(/for\s+update/i.test(sql),'Batch 64: se perdió el bloqueo FOR UPDATE del CAS.');
  need(/pg_advisory_xact_lock/i.test(sql),'Batch 64: se perdió el advisory lock de primera escritura.');
  need(/jsonb_build_object\s*\(\s*'ok'\s*,\s*false\s*,\s*'conflict'\s*,\s*true/i.test(sql),
    'Batch 64: se perdió la respuesta explícita de conflicto.');
}

if(fail.length){
  console.error('Cloud V10 revision timestamp equality verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}

console.log('Cloud V10 revision timestamp equality verification OK');
console.log(' - equivalent PostgreSQL/PostgREST timestamp spellings compare as timestamptz');
console.log(' - CAS, advisory lock and explicit conflict semantics remain intact');
