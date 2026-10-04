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
for(const cmd of ['desktop_stage_native_image','desktop_read_staged_image','desktop_verify_staged_images']){
  assert(main.includes(cmd),'Native staging RPC missing '+cmd);
  assert(!web.includes(cmd),'Web code must never access native image staging RPC');
}
for(const requirement of ['MAX_IMAGE_BYTES','Sha256','checked_id','checked_hash','read_and_verify','create_new(true)','sync_all()','image_staging','transaction()','authority":false']){
  assert(module.includes(requirement),'Native staging invariant missing '+requirement);
}
assert(main.includes('native_images::prepare_schema(&conn)'), 'native staging schema not registered');
assert(cargo.includes('base64 = "0.22"'),'base64 dependency missing');
assert(spec.includes('Batch 78')&&spec.includes('Batch 79'),'staged roadmap absent');
assert(!desktop.includes('desktop_stage_native_image'),'Desktop 0.4 authority must not auto switch image storage before certification');
console.log('Batch 77 native image staging wiring PASS — NOT image authority. Web/Desktop 0.4 behavior unchanged.');
