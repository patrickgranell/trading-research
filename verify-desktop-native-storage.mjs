import fs from 'node:fs';

const fail=(message)=>{throw new Error('Desktop native storage gate: '+message);};
const read=(path)=>fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

const cargo=read('src-tauri/Cargo.toml');
const main=read('src-tauri/src/main.rs');
const config=read('src-tauri/tauri.conf.json');
const runtime=read('desktop-native-runtime.js');
const prepare=read('desktop-prepare.mjs');

if(!cargo.includes('rusqlite'))fail('rusqlite dependency is missing.');
if(!main.includes('desktop_mirror_workspace'))fail('desktop_mirror_workspace command is missing.');
if(!main.includes('desktop_storage_status'))fail('desktop_storage_status command is missing.');
if(!main.includes('desktop_write_backup'))fail('desktop_write_backup command is missing.');
if(!main.includes('generate_handler!'))fail('Tauri invoke handler registration is missing.');
if(!config.includes('"version": "0.2.0"'))fail('Desktop version must be 0.2.0.');
if(!config.includes('"withGlobalTauri": true'))fail('window.__TAURI__ bridge must be enabled for the isolated Desktop runtime.');
if(!runtime.includes('desktop_mirror_workspace'))fail('Desktop runtime does not mirror the workspace to native storage.');
if(!runtime.includes('desktop_write_backup'))fail('Desktop runtime does not expose native Backup V2 writing.');
if(!runtime.includes('desktop_storage_status'))fail('Desktop runtime does not surface native storage status.');
if(!prepare.includes('desktop-native-runtime.js'))fail('Desktop prepare does not inject the native runtime.');

console.log('Desktop native storage gate OK.');
