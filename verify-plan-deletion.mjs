import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const runtime=fs.readFileSync('operation-cleanup-runtime.js','utf8');
const app=fs.readFileSync('app.js','utf8');
const a='/* PLAN DELETION TESTABLE CORE START */',b='/* PLAN DELETION TESTABLE CORE END */';
assert(runtime.includes(a)&&runtime.includes(b),'Missing plan-deletion testable core');
const src=runtime.split(a)[1].split(b)[0];
const projection=vm.runInNewContext(src+'; trPlanDeletionProjection',{}, {timeout:1000});
const seed={
 tradingPlans:[{id:'a',status:'active'},{id:'b',status:'archived'},{id:'c',status:'active'}],currentPlanId:'a',
 operations:[{id:'o1',tradingPlanId:'a',importBatchId:'i1'},{id:'o2',tradingPlanId:'b'},{id:'o3',tradingPlanId:'c'}],
 importBatches:[{id:'i1',tradingPlanId:'a'},{id:'i2',tradingPlanId:'c'}],
 opportunities:[{id:'p1',tradingPlanId:'a'},{id:'p2',tradingPlanId:'c'}],
 emotionalJournal:{schemaVersion:1,sessions:[{id:'s1',tradingPlanId:'a',tradingPlanSnapshot:{id:'a'}},{id:'s2',tradingPlanId:'c'}],entries:[],streakEpisodes:[],weeklyReviews:[]}
};
const clean=x=>JSON.parse(JSON.stringify(x));
const p=clean(projection(seed,['a']));
assert.deepEqual(p.next.tradingPlans.map(x=>x.id),['b','c']);
assert.deepEqual(p.next.operations.map(x=>x.id),['o2','o3']);
assert.deepEqual(p.next.importBatches.map(x=>x.id),['i2']);
assert.deepEqual(p.next.opportunities.map(x=>x.id),['p2']);
assert.equal(p.next.emotionalJournal.sessions.find(x=>x.id==='s1').tradingPlanId,'');
assert.equal(p.next.emotionalJournal.sessions.find(x=>x.id==='s1').tradingPlanSnapshot.id,'a');
assert.equal(p.next.emotionalJournal.sessions.find(x=>x.id==='s2').tradingPlanId,'c');
assert.equal(p.next.currentPlanId,'c');
assert.deepEqual(p.removedOperations.map(x=>x.id),['o1']);
assert.throws(()=>projection(seed,['a','b','c']),/al menos un Trading Plan/);
assert.throws(()=>projection(seed,['missing']),/no existe/);
const foreign=clean(seed);foreign.operations[0].tradingPlanId='c';
assert.throws(()=>projection(foreign,['a']),/otro Trading Plan/);
const foreignBatch=clean(seed);foreignBatch.operations[0].importBatchId='i2';
assert.throws(()=>projection(foreignBatch,['a']),/otro Trading Plan/);
assert(runtime.includes('trBackupV2BuildPayload')&&runtime.includes('trBackupV2Preflight'),'Deletion requires a certified complete backup');
assert(runtime.includes('plan-delete-rollback'),'Desktop rollback backup label missing');
assert(runtime.includes('trCoreFlush')&&runtime.includes('TRDomainStore.exclusive'),'Durable commit boundary missing');
assert(runtime.includes('data-tr-plan-delete-id')&&runtime.includes('data-tr-plan-delete-selected')&&runtime.includes('data-tr-plan-select'),'Single and bulk deletion UI missing');
assert(app.includes('data-tr-plan-card-id'), 'Trading Plan cards must expose a stable plan ID for grouped deletion UI');
assert(runtime.includes("querySelectorAll('[data-tr-plan-card-id]')"), 'Deletion decorator must scan every grouped and ungrouped plan card');
assert(!runtime.includes("document.querySelector('#view .plan-grid')"), 'Deletion decorator must not depend on the first plan-grid only');
assert(!runtime.includes('plansView'),'Runtime must use the explicit view contract, not a classic plansView binding.');
assert(runtime.includes('trPlanDeleteMarketReferences'),'External Market Data reference guard missing');
console.log('Plan-deletion gate OK: projection, last-plan guard, foreign references, Backup V2, single/bulk actions.');
