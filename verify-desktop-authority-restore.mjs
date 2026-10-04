/* Desktop-only Backup V2 recovery regression. Never run the desktop adapter in Web. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const html=fs.readFileSync('desktop-dist/index.html','utf8');
const start=html.indexOf('<script data-tr-backup-v2-runtime=');
assert(start>=0,'Desktop backup script missing');
const from=html.indexOf('>',start)+1,to=html.indexOf('</script>',from);
const script=html.slice(from,to);
const first=script.indexOf('async function trBackupV2PersistWorkspace(workspace){');
const last=script.indexOf('function trBackupV2RestoreIo()',first);
assert(first>=0&&last>first,'Desktop restore function boundary missing');
const restoreCode=script.slice(first,last);
const source=fs.readFileSync('backup-v2-runtime.js','utf8');
assert(source.includes("state=normalizeState(trBackupV2Clone(workspace));"),'Web source must be unchanged');
assert(restoreCode.includes('TradingResearchDesktopAuthority?.active'),'Desktop must explicitly route native recovery');
assert(restoreCode.includes('state=trBackupV2Clone(workspace)'),'Desktop must retain exact certified snapshot');
assert(restoreCode.includes("trCorePersistNow('backup-v2-restore')"),'Restore must confirm a durable workspace commit');
let normalizeCalls=0,persistCalls=0,ensures=0;
const payload={tradingPlans:[{id:'x',nonLegacyField:{v:7}}],operations:[{id:'op'}],opportunities:[],importBatches:[],settings:{instruments:[]},masterLibrary:{items:[]}};
const c={
  state:{},TradingResearchDesktopAuthority:{active:true},
  trBackupV2Clone:x=>JSON.parse(JSON.stringify(x)),
  trCoreIsValidWorkspacePayload:x=>Array.isArray(x?.tradingPlans)&&Array.isArray(x?.operations)&&!!x?.settings,
  normalizeState:x=>{normalizeCalls++;return {...x,legacyGenerated:true};},
  ensureAllPlansV8:()=>{normalizeCalls++;},ensureMasterLibrary:()=>{normalizeCalls++;},
  TRDomainStore:{ensureAttached:()=>{ensures++;}},
  trCorePersistNow:async r=>{assert.equal(r,'backup-v2-restore');persistCalls++;return true;},
  trCoreFlush:async()=>true
};
const restore=vm.runInNewContext(restoreCode+'\ntrBackupV2PersistWorkspace',vm.createContext(c));
assert.equal(await restore(payload),true);
assert.deepEqual(JSON.parse(JSON.stringify(c.state)),payload,'Desktop restored payload must be exact');
assert.equal(normalizeCalls,0,'Non-idempotent legacy normalization must never run');
assert.equal(ensures,1);assert.equal(persistCalls,1);
await assert.rejects(restore({bad:true}),/inválido/);
assert.equal(persistCalls,1,'Invalid restore must not write SQLite');
const native=fs.readFileSync('desktop-native-runtime.js','utf8');
assert(native.includes("desktop_read_authoritative_workspace")&&native.includes("trBackupV2Canonical(prepared.workspace)")&&native.includes("Readback SQLite no coincide exactamente"),'Native restore must verify exact revision/payload after commit');
console.log('Desktop restore behavior OK: certified exact payload, native commit and post-restore readback; Web unchanged.');
