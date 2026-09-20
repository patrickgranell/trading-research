import fs from 'node:fs';

const sourceDir='dist';
const desktopDir='desktop-dist';
const indexPath=desktopDir+'/index.html';

if(!fs.existsSync(sourceDir+'/index.html')){
  throw new Error('Desktop prepare requires dist/index.html. Run the normal web build first.');
}

fs.rmSync(desktopDir,{recursive:true,force:true});
fs.cpSync(sourceDir,desktopDir,{recursive:true});

let html=fs.readFileSync(indexPath,'utf8');
const supabaseSdk=/\s*<script\s+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.112\.3\/dist\/umd\/supabase\.js["']><\/script>\s*/i;
if(!supabaseSdk.test(html)){
  throw new Error('Pinned Supabase SDK tag was not found in the built HTML; desktop offline transform must be reviewed.');
}
html=html.replace(supabaseSdk,'\n');
html=html.replace('</head>','  <meta name="trading-research-desktop-channel" content="0.1.0" />\n</head>');
fs.writeFileSync(indexPath,html);
fs.rmSync(desktopDir+'/_headers',{force:true});

console.log('Prepared offline Desktop 0.1 artifact -> desktop-dist/');
