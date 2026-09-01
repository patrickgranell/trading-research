import fs from 'node:fs';
import vm from 'node:vm';

const fail=[];
const need=(condition,message)=>{if(!condition)fail.push(message);};

const app=fs.readFileSync('app.js','utf8');
const stateRuntime=fs.readFileSync('state-runtime.js','utf8');
const runtime=fs.readFileSync('backup-v2-runtime.js','utf8');

need(app.includes("let trCoreWriteBlockReason=''"),'Core durable no declara write lock para recovery.');
need(app.includes('function trCoreSetWriteBlock(')&&app.includes('function trCoreClearWriteBlock(')&&app.includes('function trCoreWriteBlocked('),
  'Core durable no expone set/clear/query del write lock.');
need((app.match(/if\(!trCoreWriteAllowed\(reason\)\)/g)||[]).length>=2,
  'Persistencia durable no aplica write lock a persist-now y queue-state-write.');

need(stateRuntime.includes('function trStateAssertWritable('),'DomainStore no tiene assertion de escritura.');
need(stateRuntime.includes('trStateAssertWritable(`set ${p}`)')
  &&stateRuntime.includes('trStateAssertWritable(`delete ${p}`)')
  &&stateRuntime.includes('trStateAssertWritable(`define ${p}`)'),
  'Proxy de state no bloquea set/delete/define durante recovery.');
need(stateRuntime.includes("startsWith('backup.restore-v2')"),
  'Exclusive boundary no reserva la vía de recuperación backup.restore-v2.');

need(runtime.includes("const TR_BACKUP_V2_WRITE_BLOCK_PREFIX='backup-v2-restore-recovery'"),
  'Backup V2 no declara motivo estable de recovery lock.');
need(runtime.includes('function trBackupV2AcquireRecoveryLock(')&&runtime.includes('function trBackupV2ReleaseRecoveryLock('),
  'Backup V2 no implementa acquire/release del recovery lock.');
need(runtime.includes('function trBackupV2SetRecoveryUiBlocked('),
  'Backup V2 no implementa bloqueo de UI durante recovery.');
need(runtime.includes('La sesión queda bloqueada contra escrituras'),
  'El fallo de restore no informa que la sesión queda write-locked.');

const loadStart=runtime.indexOf('async function trBackupV2RecoverPendingOnLoad(');
const loadWait=loadStart<0?-1:runtime.indexOf('for(let i=0;i<200',loadStart);
const loadHydrationCheck=loadStart<0?-1:runtime.indexOf("if(typeof trCoreHydrated!=='undefined'&&!trCoreHydrated)",loadStart);
const loadAcquire=loadStart<0?-1:runtime.indexOf('trBackupV2AcquireRecoveryLock(journal)',loadStart);
need(loadStart>=0&&loadWait>loadStart&&loadHydrationCheck>loadWait&&loadAcquire>loadHydrationCheck,
  'Recovery on-load activa el durable lock antes de completar hydration.');

const coreStart=app.indexOf("let trCoreWriteBlockReason='';");
const coreEnd=coreStart<0?-1:app.indexOf('const trCoreBootHadMarker',coreStart);
const assertStart=stateRuntime.indexOf('function trStateAssertWritable(');
const assertEnd=assertStart<0?-1:stateRuntime.indexOf('\nfunction trStateRecordMutation',assertStart);
need(coreStart>=0&&coreEnd>coreStart&&assertStart>=0&&assertEnd>assertStart,
  'No se pudieron aislar los guards reales de core/DomainStore.');

if(coreStart>=0&&coreEnd>coreStart&&assertStart>=0&&assertEnd>assertStart){
  const guard={};
  vm.createContext(guard);
  vm.runInContext(
    app.slice(coreStart,coreEnd)
      +'\n'+stateRuntime.slice(assertStart,assertEnd)
      +'\nthis.api={set:trCoreSetWriteBlock,clear:trCoreClearWriteBlock,blocked:trCoreWriteBlocked,allowed:trCoreWriteAllowed,assertWritable:trStateAssertWritable};',
    guard
  );

  guard.api.set('backup-v2-restore-recovery:RST2_GUARD');
  need(guard.api.blocked()===true,'Core lock no queda activo.');
  need(guard.api.allowed('user.edit')===false,'Core lock permite una persistencia normal.');
  need(guard.api.allowed('backup-v2-restore')===true,'Core lock impide la persistencia autorizada del restore.');
  let mutationError=null;
  try{guard.api.assertWritable('fault-injection.user-edit');}catch(e){mutationError=e;}
  need(!!mutationError,'DomainStore permite mutar state mientras recovery lock está activo.');

  guard.api.clear('backup-v2-restore-recovery:RST2_GUARD');
  let clearError=null;
  try{guard.api.assertWritable('after-recovery');}catch(e){clearError=e;}
  need(!clearError&&!guard.api.blocked(),'El lock no se libera con su motivo exacto.');
}

const helperStart=runtime.indexOf('function trBackupV2RecoveryLockReason(');
const helperEnd=helperStart<0?-1:runtime.indexOf('\n\nasync function trBackupV2ImageWriteTransaction',helperStart);
const protocolStart=runtime.indexOf('async function trBackupV2RestoreProtocol(');
const protocolEnd=protocolStart<0?-1:runtime.indexOf('\n\nasync function trBackupV2RecoverPending',protocolStart);
const recoverStart=runtime.indexOf('async function trBackupV2RecoverPending(');
const recoverEnd=recoverStart<0?-1:runtime.indexOf('\n\nasync function trBackupV2RefreshUiAfterRestore',recoverStart);
need(helperStart>=0&&helperEnd>helperStart&&protocolStart>=0&&protocolEnd>protocolStart&&recoverStart>=0&&recoverEnd>recoverStart,
  'No se pudieron aislar helpers/protocol/recovery para fault injection.');

if(helperStart>=0&&helperEnd>helperStart&&protocolStart>=0&&protocolEnd>protocolStart&&recoverStart>=0&&recoverEnd>recoverStart){
  const lockState={reason:'',ui:false};
  const context={
    TR_BACKUP_V2_JOURNAL_ID:'journal',
    TR_BACKUP_V2_SCHEMA:2,
    TR_BACKUP_V2_WRITE_BLOCK_PREFIX:'backup-v2-restore-recovery',
    uid:()=> 'RST2_TEST',
    trBackupV2Clone:value=>JSON.parse(JSON.stringify(value)),
    trBackupV2RestoreIo:()=>{throw new Error('default IO no debe usarse en fault injection');},
    trCoreSetWriteBlock:reason=>{lockState.reason=String(reason||'');return lockState.reason;},
    trCoreClearWriteBlock:reason=>{if(!reason||lockState.reason===String(reason))lockState.reason='';return !lockState.reason;},
    trCoreWriteBlocked:()=>!!lockState.reason,
    document:{documentElement:{classList:{toggle:(_name,value)=>{lockState.ui=!!value;}}}}
  };
  vm.createContext(context);
  vm.runInContext(
    runtime.slice(helperStart,helperEnd)
      +'\n'+runtime.slice(protocolStart,protocolEnd)
      +'\n'+runtime.slice(recoverStart,recoverEnd)
      +'\nthis.protocol=trBackupV2RestoreProtocol;this.recover=trBackupV2RecoverPending;this.uiBlock=trBackupV2SetRecoveryUiBlocked;',
    context
  );

  const prepared={
    workspace:{sentinel:'target'},
    images:[{id:'IMG1'}],
    marketData:{},
    manifest:{expectedImageIds:['IMG1'],hashes:{workspace:'target-hash',images:{}}}
  };

  {
    const calls=[];
    lockState.reason='';
    const io={
      journalPut:async journal=>{calls.push('journal:'+journal.phase);if(journal.phase==='market-committed')throw new Error('journal write after market commit failed');},
      journalDelete:async()=>calls.push('journal-delete'),
      stageImages:async()=>calls.push('stage-images'),
      verifyStage:async()=>calls.push('verify-stage'),
      replaceMarketData:async()=>calls.push('market-commit'),
      finalizeImages:async()=>calls.push('image-commit'),
      persistWorkspace:async()=>calls.push('workspace-commit'),
      cleanupStage:async()=>calls.push('stage-cleanup')
    };
    let error=null;
    try{await context.protocol(prepared,io);}catch(e){error=e;}
    need(!!error,'Fault injection posterior a Market Data no interrumpió el restore.');
    need(calls.includes('market-commit')&&!calls.includes('workspace-commit'),
      'El fallo post-Market publicó workspace indebidamente.');
    need(lockState.reason==='backup-v2-restore-recovery:RST2_TEST',
      'El fallo post-Market dejó la sesión escribible pese al journal recuperable.');
  }

  {
    const calls=[];
    lockState.reason='';
    const io={
      journalPut:async journal=>calls.push('journal:'+journal.phase),
      journalDelete:async()=>calls.push('journal-delete'),
      stageImages:async()=>calls.push('stage-images'),
      verifyStage:async()=>calls.push('verify-stage'),
      replaceMarketData:async()=>calls.push('market-commit'),
      finalizeImages:async()=>calls.push('image-commit'),
      persistWorkspace:async()=>calls.push('workspace-commit'),
      cleanupStage:async()=>calls.push('stage-cleanup')
    };
    await context.protocol(prepared,io);
    need(lockState.reason==='','Restore exitoso no liberó el recovery lock.');
    need(calls.at(-1)==='journal-delete','Restore exitoso no cerró el journal al final.');
  }

  const journal={
    schema:2,
    restoreId:'RST2_RECOVER',
    targetWorkspace:{sentinel:'target'},
    manifest:{hashes:{workspace:'target-hash'}}
  };

  {
    const calls=[];
    lockState.reason='';
    context.TRDomainStore={snapshot:()=>({sentinel:'current'})};
    context.state={sentinel:'current'};
    context.trBackupV2MarketMatchesManifest=async()=>true;
    context.trBackupV2HashCanonical=async()=> 'current-hash';
    context.trBackupV2FinalImagesMatch=async()=>true;
    context.trBackupV2VerifyStage=async()=>calls.push('verify-stage');
    context.trBackupV2FinalizeImages=async()=>calls.push('finalize-images');
    context.trBackupV2PersistWorkspace=async()=>calls.push('workspace-commit');
    context.trBackupV2CleanupStage=async()=>calls.push('stage-cleanup');
    context.trBackupV2JournalDelete=async()=>calls.push('journal-delete');

    const out=await context.recover(journal);
    need(out?.status==='completed-forward','Forward recovery no terminó en completed-forward.');
    need(JSON.stringify(calls)===JSON.stringify(['workspace-commit','stage-cleanup','journal-delete']),
      'Forward recovery ejecutó una secuencia inesperada: '+calls.join(' -> '));
    need(lockState.reason==='','Forward recovery exitoso no liberó el lock.');
  }

  {
    const calls=[];
    lockState.reason='';
    context.TRDomainStore={snapshot:()=>({sentinel:'current'})};
    context.trBackupV2MarketMatchesManifest=async()=>true;
    context.trBackupV2HashCanonical=async()=> 'current-hash';
    context.trBackupV2FinalImagesMatch=async()=>true;
    context.trBackupV2PersistWorkspace=async()=>{calls.push('workspace-commit');throw new Error('workspace commit failed');};
    context.trBackupV2CleanupStage=async()=>calls.push('stage-cleanup');
    context.trBackupV2JournalDelete=async()=>calls.push('journal-delete');

    let error=null;
    try{await context.recover(journal);}catch(e){error=e;}
    need(!!error,'Fault injection en forward recovery no propagó el error.');
    need(lockState.reason==='backup-v2-restore-recovery:RST2_RECOVER',
      'Forward recovery fallido liberó el lock antes de resolver el journal.');
    need(!calls.includes('journal-delete'),'Forward recovery fallido borró el journal.');
  }

  {
    const calls=[];
    lockState.reason='';
    context.TRDomainStore={snapshot:()=>({sentinel:'current'})};
    context.trBackupV2MarketMatchesManifest=async()=>false;
    context.trBackupV2HashCanonical=async()=> 'current-hash';
    context.trBackupV2CleanupStage=async()=>calls.push('stage-cleanup');
    context.trBackupV2JournalDelete=async()=>calls.push('journal-delete');

    const out=await context.recover(journal);
    need(out?.status==='aborted-before-market','Recovery pre-Market no abortó de forma segura.');
    need(JSON.stringify(calls)===JSON.stringify(['stage-cleanup','journal-delete']),
      'Abort pre-Market ejecutó una secuencia inesperada: '+calls.join(' -> '));
    need(lockState.reason==='','Abort seguro pre-Market no liberó el lock.');
  }

  {
    lockState.reason='backup-v2-restore-recovery:RST2_RECOVER';
    context.uiBlock(false);
    need(lockState.ui===true,'La UI se habilita mientras el core sigue write-locked.');
    lockState.reason='';
    context.uiBlock(false);
    need(lockState.ui===false,'La UI no se libera después de resolver el lock.');
  }
}

if(fail.length){
  console.error('Restore Recovery Lock verification FAILED');
  for(const item of fail)console.error(' - '+item);
  process.exit(1);
}

console.log('Restore Recovery Lock verification OK');
console.log(' - pending journal => durable write lock');
console.log(' - DomainStore/proxy + core persistence reject user writes');
console.log(' - post-Market fault keeps lock active');
console.log(' - forward recovery or safe pre-Market abort clears lock');
console.log(' - on-load lock waits for durable hydration; UI remains blocked meanwhile');
