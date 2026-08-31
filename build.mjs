import fs from 'node:fs';
import crypto from 'node:crypto';
import {consolidateLegacyRenderAssignments,renderDebtInventory} from './render-source-transform.mjs';
import {transformStateActions} from './state-action-transform.mjs';
import {pruneAppGlobalExports} from './app-global-prune-transform.mjs';
import {pruneCandidateInventory} from './prune-candidate-inventory.mjs';
import {remainingGlobalContractMap} from './remaining-global-contract-map.mjs';
import {migrateStateActionsToRegistry} from './state-registry-migration-transform.mjs';
import {migrateUiHandlersToRegistry} from './ui-registry-migration-transform.mjs';
import {closeResidualDirectMirrors} from './residual-mirror-closure-transform.mjs';
import {transformStyleAttrs,styleTransformSelfTest} from './html-style-transform.mjs';
import {transformStructuredEventSources,structuredEventTransformSelfTest,injectStructuredEventPlans} from './structured-event-transform.mjs';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const v=pkg.version;
const styleSelfTest=styleTransformSelfTest();if(!styleSelfTest.ok)throw new Error(`Style transform self-test failed: ${JSON.stringify(styleSelfTest.failures)}`);
const structuredEventSelfTest=structuredEventTransformSelfTest();if(!structuredEventSelfTest.ok)throw new Error(`Structured event transform self-test failed: ${JSON.stringify(structuredEventSelfTest.failures)}`);
fs.rmSync('dist',{recursive:true,force:true});
fs.mkdirSync('dist',{recursive:true});
let h=fs.readFileSync('index.html','utf8');
const css=fs.readFileSync('styles.css','utf8');
const safeScript=s=>s.replace(/<\/script/gi,'<\\/script');
const rawScript=file=>fs.readFileSync(file,'utf8');
const bundledScript=file=>safeScript(transformStyleAttrs(rawScript(file)).source);
const appSource=rawScript('app.js');
const appConsolidation=consolidateLegacyRenderAssignments(appSource,{expected:12});
const appGlobalPruneRuntimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','render-closure-runtime.js'];
const appGlobalPruneRuntimeSources=appGlobalPruneRuntimeFiles.map(rawScript);
const pruneCandidates=pruneCandidateInventory(appConsolidation.source,{runtimeSources:appGlobalPruneRuntimeSources,stateActionTransformSource:rawScript('state-action-transform.mjs')});
const appGlobalPrune=pruneAppGlobalExports(appConsolidation.source,{runtimeSources:appGlobalPruneRuntimeSources});
const stateRegistryMigration=migrateStateActionsToRegistry(appGlobalPrune.source);
const uiRegistryMigration=migrateUiHandlersToRegistry(stateRegistryMigration.source);
const residualMirrorClosure=closeResidualDirectMirrors(uiRegistryMigration.source);
const dynamicActionInventory=appGlobalPrune.inventory.dynamicActionGuard;
const stateSource=rawScript('state-runtime.js');
const stateActionBridge=transformStateActions(stateSource);
const contractMapRuntimeSources=appGlobalPruneRuntimeFiles.map(file=>file==='state-runtime.js'?stateActionBridge.source:rawScript(file));
const remainingContracts=remainingGlobalContractMap(residualMirrorClosure.source,{runtimeSources:contractMapRuntimeSources,stateActionTransformSource:rawScript('state-action-transform.mjs')});

/* V31.24 D04/D11: compile historical handler programs at BUILD TIME only.
 * Runtime receives static plan IDs plus URI-encoded JSON values. */
const runtimeFiles=['style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js'];
const preEventSources=Object.fromEntries(runtimeFiles.map(file=>[file,file==='state-runtime.js'?stateActionBridge.source:rawScript(file)]));
preEventSources['app.js']=residualMirrorClosure.source;
const structuredEventTransform=transformStructuredEventSources(Object.entries(preEventSources).map(([name,source])=>({name,source})));
structuredEventTransform.sources['event-runtime.js']=injectStructuredEventPlans(structuredEventTransform.sources['event-runtime.js'],structuredEventTransform.plans);
const structuredEventInventory={version:v,selfTest:true,...structuredEventTransform.inventory};
const styleTransformedSources=Object.fromEntries(Object.entries(structuredEventTransform.sources).map(([file,source])=>[file,transformStyleAttrs(source)]));
const bundledSource=file=>safeScript(styleTransformedSources[file].source);
const appStyleTransform=styleTransformedSources['app.js'];
const stateStyleTransform=styleTransformedSources['state-runtime.js'];
const bundledApp=bundledSource('app.js');
const bundledState=bundledSource('state-runtime.js');
const replacements=[
  ['app.js','data-tr-build',bundledApp],
  ['style-attr-runtime.js','data-tr-style-attr-runtime',bundledSource('style-attr-runtime.js')],
  ['reports-purity-runtime.js','data-tr-reports-purity-runtime',bundledSource('reports-purity-runtime.js')],
  ['structural-runtime.js','data-tr-structural-runtime',bundledSource('structural-runtime.js')],
  ['state-runtime.js','data-tr-state-runtime',bundledState],
  ['persistence-coalescing-runtime.js','data-tr-persistence-coalescing-runtime',bundledSource('persistence-coalescing-runtime.js')],
  ['backup-v2-runtime.js','data-tr-backup-v2-runtime',bundledSource('backup-v2-runtime.js')],
  ['security-runtime.js','data-tr-security-runtime',bundledSource('security-runtime.js')],
  ['event-runtime.js','data-tr-event-runtime',bundledSource('event-runtime.js')],
  ['csp-runtime.js','data-tr-csp-runtime',bundledSource('csp-runtime.js')],
  ['style-runtime.js','data-tr-style-runtime',bundledSource('style-runtime.js')],
  ['operation-cleanup-runtime.js','data-tr-operation-cleanup-runtime',bundledSource('operation-cleanup-runtime.js')],
  ['blob-lifecycle-runtime.js','data-tr-blob-lifecycle-runtime',bundledSource('blob-lifecycle-runtime.js')],
  ['render-closure-runtime.js','data-tr-render-closure-runtime',bundledSource('render-closure-runtime.js')],
];
const sha256=s=>`'sha256-${crypto.createHash('sha256').update(s,'utf8').digest('base64')}'`;
const styleSourceFiles=['app.js','style-attr-runtime.js','reports-purity-runtime.js','structural-runtime.js','state-runtime.js','persistence-coalescing-runtime.js','backup-v2-runtime.js','security-runtime.js','event-runtime.js','csp-runtime.js','style-runtime.js','operation-cleanup-runtime.js','blob-lifecycle-runtime.js','render-closure-runtime.js','index.html'];
const styleSourceText=styleSourceFiles.map(file=>fs.readFileSync(file,'utf8')).join('\n');
const styleInlineAttributes=[...styleSourceText.matchAll(/\bstyle\s*=\s*["']/gi)].length;
const styleCssomWrites=[...styleSourceText.matchAll(/\.style\.[A-Za-z_$][\w$]*\s*=/g)].length+[...styleSourceText.matchAll(/setAttribute\s*\(\s*["']style["']/gi)].length;
const transformedScriptText=replacements.map(([, ,src])=>src).join('\n');
const effectiveInlineAttributes=[...transformedScriptText.matchAll(/([<\s])style\s*=\s*["']/gi)].length;
const styleProperties={};
for(const file of styleSourceFiles){
  const src=fs.readFileSync(file,'utf8');
  for(const m of src.matchAll(/\bstyle\s*=\s*(["'])(.*?)\1/gis))for(const prop of m[2].matchAll(/(?:^|;)\s*([a-zA-Z-]+)\s*:/g))styleProperties[prop[1]]=(styleProperties[prop[1]]||0)+1;
  for(const m of src.matchAll(/\.style\.([A-Za-z_$][\w$]*)\s*=/g))styleProperties[m[1]]=(styleProperties[m[1]]||0)+1;
}
const sourceRenderDebt=renderDebtInventory(appSource);
const bundledRenderDebt=renderDebtInventory(residualMirrorClosure.source);
const renderInventory={version:v,source:{...sourceRenderDebt},bundled:{...bundledRenderDebt},removedAssignments:appConsolidation.removed,closureRuntime:'render-closure-runtime.js',canonicalChain:['structural-runtime.js','state-runtime.js','render-closure-runtime.js']};
const stateActionInventory={version:v,...stateActionBridge.inventory};
const appGlobalPruneInventory={version:v,...appGlobalPrune.inventory};
const stateRegistryMigrationManifest={version:v,...stateRegistryMigration.inventory};
const uiRegistryMigrationManifest={version:v,...uiRegistryMigration.inventory};
const residualMirrorClosureManifest={version:v,...residualMirrorClosure.inventory};
const pruneCandidateManifest={version:v,...pruneCandidates};
const remainingContractManifest={version:v,...remainingContracts};

h=h.replace(/<link\s+rel=["']stylesheet["']\s+href=["']styles\.css["']\s*\/?\s*>/i,()=>`<style data-tr-build="${v}">${css}</style>`);
for(const [file,attr,src] of replacements){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`<script\\s+src=["']${escaped}["']\\s*><\\/script>`,'i');
  h=h.replace(re,()=>`<script ${attr}="${v}">${src}</script>`);
}
h=h.replace('</head>',()=>`  <meta name="trading-research-build-version" content="${v}" />\n  <meta name="trading-research-csp-version" content="${v}" />\n  <meta name="trading-research-style-source-inline-attrs" content="${styleInlineAttributes}" />\n  <meta name="trading-research-style-effective-inline-attrs" content="${effectiveInlineAttributes}" />\n  <meta name="trading-research-style-source-cssom-writes" content="${styleCssomWrites}" />\n  <meta name="trading-research-render-source-legacy-assignments" content="${sourceRenderDebt.assignments}" />\n  <meta name="trading-research-render-bundled-legacy-assignments" content="${bundledRenderDebt.assignments}" />\n  <meta name="trading-research-app-global-source-blocks" content="${appGlobalPrune.inventory.before.objectAssignBlocks}" />\n  <meta name="trading-research-app-global-bundled-blocks" content="${residualMirrorClosure.inventory.after.blocks}" />\n  <meta name="trading-research-app-global-source-entries" content="${appGlobalPrune.inventory.before.objectAssignEntries}" />\n  <meta name="trading-research-app-global-bundled-entries" content="${residualMirrorClosure.inventory.after.entries}" />\n  <meta name="trading-research-app-global-source-unique" content="${appGlobalPrune.inventory.before.objectAssignUnique}" />\n  <meta name="trading-research-app-global-bundled-unique" content="${residualMirrorClosure.inventory.after.unique}" />\n  <meta name="trading-research-state-registry-migrated" content="${stateRegistryMigration.inventory.names.length}" />\n  <meta name="trading-research-state-registry-batch1" content="${stateRegistryMigration.inventory.batches.batch1.length}" />\n  <meta name="trading-research-state-registry-batch2" content="${stateRegistryMigration.inventory.batches.batch2.length}" />\n  <meta name="trading-research-state-registry-batch3" content="${stateRegistryMigration.inventory.batches.batch3.length}" />\n  <meta name="trading-research-state-registry-batch4" content="${stateRegistryMigration.inventory.batches.batch4.length}" />\n  <meta name="trading-research-state-registry-batch5" content="${stateRegistryMigration.inventory.batches.batch5.length}" />\n  <meta name="trading-research-state-registry-batch6" content="${stateRegistryMigration.inventory.batches.batch6.length}" />\n  <meta name="trading-research-state-registry-batch7" content="${stateRegistryMigration.inventory.batches.batch7.length}" />\n  <meta name="trading-research-ui-registry-migrated" content="${uiRegistryMigration.inventory.names.length}" />\n  <meta name="trading-research-ui-registry-batch1" content="${uiRegistryMigration.inventory.batches.batch1.length}" />\n  <meta name="trading-research-ui-registry-batch2" content="${uiRegistryMigration.inventory.batches.batch2.length}" />\n  <meta name="trading-research-ui-registry-batch3" content="${uiRegistryMigration.inventory.batches.batch3.length}" />\n  <meta name="trading-research-ui-registry-batch4" content="${uiRegistryMigration.inventory.batches.batch4.length}" />\n  <meta name="trading-research-ui-registry-batch5" content="${uiRegistryMigration.inventory.batches.batch5.length}" />\n  <meta name="trading-research-ui-registry-batch6" content="${uiRegistryMigration.inventory.batches.batch6.length}" />\n  <meta name="trading-research-ui-registry-batch7" content="${uiRegistryMigration.inventory.batches.batch7.length}" />\n  <meta name="trading-research-ui-registry-batch8" content="${uiRegistryMigration.inventory.batches.batch8.length}" />\n  <meta name="trading-research-ui-registry-batch9" content="${uiRegistryMigration.inventory.batches.batch9.length}" />\n  <meta name="trading-research-ui-registry-batch10" content="${uiRegistryMigration.inventory.batches.batch10.length}" />\n  <meta name="trading-research-ui-registry-batch11" content="${uiRegistryMigration.inventory.batches.batch11.length}" />\n  <meta name="trading-research-residual-mirror-closed" content="${residualMirrorClosure.inventory.names.length}" />\n  <meta name="trading-research-prune-safe-candidates" content="${pruneCandidates.safeCandidateCount}" />\n  <meta name="trading-research-dynamic-handler-slots" content="${dynamicActionInventory.dynamicHandlerSlots}" />\n  <meta name="trading-research-dynamic-protected-globals" content="${dynamicActionInventory.protectedDynamicGlobals}" />\n  <meta name="trading-research-dynamic-candidate-roots" content="${dynamicActionInventory.dynamicCandidateRoots}" />\n  <meta name="trading-research-contract-map-remaining" content="${remainingContracts.remainingUnique}" />\n  <meta name="trading-research-contract-map-classified" content="${remainingContracts.classified}" />\n  <meta name="trading-research-contract-map-unclassified" content="${remainingContracts.unclassified}" />\n  <meta name="trading-research-contract-map-multi" content="${remainingContracts.multiContract}" />\n  <meta name="trading-research-contract-map-primary-state" content="${remainingContracts.byPrimary['state-action']||0}" />\n  <meta name="trading-research-contract-map-primary-handler" content="${remainingContracts.byPrimary['ui-handler']||0}" />\n  <meta name="trading-research-contract-map-primary-dynamic" content="${remainingContracts.byPrimary['dynamic-action']||0}" />\n  <meta name="trading-research-contract-map-state-frontier" content="${remainingContracts.names.migrationFrontiers.stateOnly.length}" />\n  <meta name="trading-research-contract-map-handler-frontier" content="${remainingContracts.names.migrationFrontiers.handlerOnly.length}" />\n  <meta name="trading-research-contract-map-cross-runtime" content="${remainingContracts.coverage.crossRuntimeRead}" />\n</head>`);
fs.writeFileSync('dist/index.html',h);

const scriptHashes=replacements.map(([, ,src])=>sha256(src));
const styleHash=sha256(css);
const supabasePath='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/';
const csp=["default-src 'none'","base-uri 'none'","object-src 'none'","frame-ancestors 'none'","form-action 'self'","script-src 'none'",`script-src-elem ${scriptHashes.join(' ')} ${supabasePath}`,"script-src-attr 'none'","style-src 'none'",`style-src-elem ${styleHash}`,"style-src-attr 'none'","img-src 'self' blob: https://*.supabase.co","connect-src 'self' https://*.supabase.co wss://*.supabase.co","font-src 'self'","media-src 'none'","frame-src 'none'","worker-src 'none'","manifest-src 'self'","upgrade-insecure-requests"].join('; ')+ ';';
const headers=`/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()\n`;
fs.writeFileSync('dist/_headers',headers);
fs.writeFileSync('dist/csp-manifest.json',JSON.stringify({version:v,scriptHashes,styleHash,supabasePath,csp},null,2)+'\n');
fs.writeFileSync('dist/style-inventory.json',JSON.stringify({version:v,sourceFiles:styleSourceFiles,inlineAttributes:styleInlineAttributes,effectiveInlineAttributes,cssomWrites:styleCssomWrites,totalSourceDebt:styleInlineAttributes+styleCssomWrites,transform:{kind:'open-tag-context-scanner',selfTest:true,appConverted:appStyleTransform.converted,stateConverted:stateStyleTransform.converted},properties:Object.fromEntries(Object.entries(styleProperties).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))},null,2)+'\n');
fs.writeFileSync('dist/render-inventory.json',JSON.stringify(renderInventory,null,2)+'\n');
fs.writeFileSync('dist/state-action-inventory.json',JSON.stringify(stateActionInventory,null,2)+'\n');
fs.writeFileSync('dist/app-global-prune-inventory.json',JSON.stringify(appGlobalPruneInventory,null,2)+'\n');
fs.writeFileSync('dist/state-registry-migration-inventory.json',JSON.stringify(stateRegistryMigrationManifest,null,2)+'\n');
fs.writeFileSync('dist/ui-registry-migration-inventory.json',JSON.stringify(uiRegistryMigrationManifest,null,2)+'\n');
fs.writeFileSync('dist/residual-mirror-closure-inventory.json',JSON.stringify(residualMirrorClosureManifest,null,2)+'\n');
fs.writeFileSync('dist/dynamic-action-inventory.json',JSON.stringify({version:v,...dynamicActionInventory},null,2)+'\n');
fs.writeFileSync('dist/prune-candidate-inventory.json',JSON.stringify(pruneCandidateManifest,null,2)+'\n');
fs.writeFileSync('dist/remaining-global-contract-map.json',JSON.stringify(remainingContractManifest,null,2)+'\n');
fs.writeFileSync('dist/structured-event-inventory.json',JSON.stringify(structuredEventInventory,null,2)+'\n');
console.log(`Built Trading Research ${v} -> dist/index.html`);
console.log(`Generated CSP -> dist/_headers (${scriptHashes.length} script hashes + 1 style hash)`);
console.log(`Style boundary -> ${styleInlineAttributes} legacy attrs inventoried; ${effectiveInlineAttributes} effective inline attrs`);
console.log(`Style transform -> open-tag context scanner; app ${appStyleTransform.converted}, state ${stateStyleTransform.converted}`);
console.log(`Style inventory -> ${styleCssomWrites} direct CSSOM writes remain allowed by the strict attribute policy`);
console.log(`Render consolidation -> removed ${appConsolidation.removed} legacy assignments from bundled app; bundled legacy assignments ${bundledRenderDebt.assignments}`);
console.log(`State Action Bridge -> ${stateActionBridge.inventory.resolveCalls} registry-aware resolves, ${stateActionBridge.inventory.publishCalls} publishes, ${stateActionBridge.inventory.crossRuntimeWindowReads} direct cross-runtime window reads`);
console.log(`App global prune -> blocks ${appGlobalPrune.inventory.before.objectAssignBlocks} -> ${appGlobalPrune.inventory.after.objectAssignBlocks}; entries ${appGlobalPrune.inventory.before.objectAssignEntries} -> ${appGlobalPrune.inventory.after.objectAssignEntries}; unique ${appGlobalPrune.inventory.before.objectAssignUnique} -> ${appGlobalPrune.inventory.after.objectAssignUnique}`);
console.log(`State Registry Migration VII -> ${stateRegistryMigration.inventory.names.length} cumulative names (${Object.values(stateRegistryMigration.inventory.batches).map(x=>x.length).join('+')}); explicit blocks ${stateRegistryMigration.inventory.before.blocks} -> ${stateRegistryMigration.inventory.after.blocks}; entries ${stateRegistryMigration.inventory.before.entries} -> ${stateRegistryMigration.inventory.after.entries}; unique ${stateRegistryMigration.inventory.before.unique} -> ${stateRegistryMigration.inventory.after.unique}`);
console.log(`UI Registry Migration XXVIII FINAL -> ${uiRegistryMigration.inventory.names.length} names; explicit blocks ${uiRegistryMigration.inventory.before.blocks} -> ${uiRegistryMigration.inventory.after.blocks}; entries ${uiRegistryMigration.inventory.before.entries} -> ${uiRegistryMigration.inventory.after.entries}; unique ${uiRegistryMigration.inventory.before.unique} -> ${uiRegistryMigration.inventory.after.unique}`);
console.log(`Residual Mirror Closure V31.23.48 -> ${residualMirrorClosure.inventory.names.length} names; blocks ${residualMirrorClosure.inventory.before.blocks} -> ${residualMirrorClosure.inventory.after.blocks}; entries ${residualMirrorClosure.inventory.before.entries} -> ${residualMirrorClosure.inventory.after.entries}; unique ${residualMirrorClosure.inventory.before.unique} -> ${residualMirrorClosure.inventory.after.unique}; direct mirrors ${residualMirrorClosure.inventory.directMirrorsRemoved} removed`);
console.log(`Prune Candidate Closure -> ${pruneCandidates.safeCandidateCount} contract-safe explicit candidates remain`);
console.log(`Remaining Global Contract Map -> ${remainingContracts.classified}/${remainingContracts.remainingUnique} classified; primary State ${remainingContracts.byPrimary['state-action']||0}, handler ${remainingContracts.byPrimary['ui-handler']||0}, dynamic ${remainingContracts.byPrimary['dynamic-action']||0}; State frontier ${remainingContracts.names.migrationFrontiers.stateOnly.length}; handler frontier ${remainingContracts.names.migrationFrontiers.handlerOnly.length}; cross-runtime ${remainingContracts.coverage.crossRuntimeRead}`);
console.log(`Dynamic Action Guard -> ${dynamicActionInventory.dynamicHandlerSlots} dynamic handler slots; ${dynamicActionInventory.dynamicCandidateRoots} candidate roots; ${dynamicActionInventory.protectedDynamicGlobals} protected exported globals`);
console.log(`Structured Event Boundary -> ${structuredEventInventory.converted} handlers compiled to ${structuredEventInventory.uniquePlans} static plans; ${structuredEventInventory.dynamicSlots} value slots; ${structuredEventInventory.dynamicActionRejected} dynamic actions rejected`);