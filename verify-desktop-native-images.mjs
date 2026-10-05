/* Batch 77: STAGING (not promoted) native-image safety/wiring check.
 * Rust behavior tests cover actual file IO; this gate catches accidental Web
 * changes, missing RPCs, or premature authority promotion.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const main=fs.readFileSync('src-tauri/src/main.rs','utf8');
const module=fs.readFileSync('src-tauri/src/native_images.rs','utf8');
const cargo=fs.readFileSync('src-tauri/Cargo.toml','utf8');
const web=fs.readFileSync('app.js','utf8');
const desktop=fs.readFileSync('desktop-authority-bridge.js','utf8');
const spec=fs.readFileSync('DESKTOP-NATIVE-IMAGES.md','utf8');
for(const cmd of ['desktop_stage_native_image','desktop_read_staged_image','desktop_verify_staged_images','desktop_finalize_native_image_staging','desktop_native_image_staging_status','desktop_native_image_authority_status','desktop_promote_native_image_authority','desktop_native_image_batch','desktop_read_native_image','desktop_list_native_images','desktop_gc_native_image_objects']){
  assert(main.includes(cmd),'Native staging RPC missing '+cmd);
  assert(!web.includes(cmd),'Web code must never access native image staging RPC');
}
for(const requirement of ['MAX_IMAGE_BYTES','Sha256','checked_id','checked_hash','read_and_verify','create_new(true)','sync_all()','image_staging','transaction()','authority":false']){
  assert(module.includes(requirement),'Native staging invariant missing '+requirement);
}
assert(main.includes('native_images::prepare_schema(&conn)'), 'native staging schema not registered');
assert(main.includes('let payload_sha=sha256_text(&payload);')&&!main.includes('Relectura rollback de staging'),'Rollback validation/hash must bind to one filesystem read');
assert(module.includes('gc_objects'),'Native image authority invariant missing gc_objects');
assert(module.includes('batch_commit'),'Native image authority invariant missing batch_commit');
assert(module.includes('require_generation'),'Native image authority invariant missing require_generation');
assert(module.includes('native-images-authority.marker'),'Native image authority invariant missing native-images-authority.marker');
assert(cargo.includes('base64 = "0.22"'),'base64 dependency missing');
assert(spec.includes('Batch 78')&&spec.includes('Batch 79'),'staged roadmap absent');
assert(!desktop.includes('desktop_stage_native_image'),'Certified Desktop workspace authority bridge must not auto switch image storage before certification');
assert(desktop.includes('trDesktopImageBootstrapAuthority')&&desktop.includes('trDesktopImageQueueBatch'),'Desktop image authority must bootstrap before UI and serialize CAS writes.');
assert(desktop.includes("trDesktopAuthorityStop(e,'Imágenes nativas')")&&desktop.includes('Almacenamiento nativo de imágenes requiere recuperación'),'Native-image corruption must surface its own recovery boundary.');
assert(fs.readFileSync('desktop-native-images-runtime.js','utf8').includes("label:'desktop-image-stage-rollback'"),'Image staging must require native Backup V2 first');
const imageRuntime=fs.readFileSync('desktop-native-images-runtime.js','utf8');
assert(imageRuntime.includes("if(document.getElementById('desktop-native-images-host'))return;"),'Native image mount must no-op when host already exists.');
assert(!/desktop-native-images-host'\)\)\{paint\(\);return;\}/.test(imageRuntime),'MutationObserver must never repaint an already-mounted native image host.');
console.log('Batch 77 native image staging wiring PASS — NOT image authority. Web/Desktop 0.4 behavior unchanged.');

if(fs.existsSync('desktop-dist/index.html')){
  const html=fs.readFileSync('desktop-dist/index.html','utf8');
  for(const token of ['trading-research-desktop-native-images','trDesktopImageWriteFile(file,id)','trDesktopImageReadBlob(id)',"trDesktopImageWriteTransaction(puts,deletes,'backup-v2.images')",'trDesktopImageGcDeleteLocalIds(targets)'])assert(html.includes(token),'Generated Desktop artifact missing native image route: '+token);
}
