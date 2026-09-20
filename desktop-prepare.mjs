import fs from 'node:fs';

const sourceDir='dist';
const desktopDir='desktop-dist';
const indexPath=desktopDir+'/index.html';

if(!fs.existsSync(sourceDir+'/index.html')){
  throw new Error('Desktop prepare requires dist/index.html. Run the normal web build first.');
}
if(!fs.existsSync('desktop-native-runtime.js')){
  throw new Error('Desktop native runtime is missing.');
}

fs.rmSync(desktopDir,{recursive:true,force:true});
fs.cpSync(sourceDir,desktopDir,{recursive:true});

let html=fs.readFileSync(indexPath,'utf8');
const supabaseSdk=/\s*<script\s+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2\.112\.3\/dist\/umd\/supabase\.js["']><\/script>\s*/i;
if(!supabaseSdk.test(html)){
  throw new Error('Pinned Supabase SDK tag was not found in the built HTML; desktop offline transform must be reviewed.');
}
html=html.replace(supabaseSdk,'\n');
html=html.replace('</head>','  <meta name="trading-research-desktop-channel" content="0.2.0" />\n</head>');

const runtime=fs.readFileSync('desktop-native-runtime.js','utf8').replace(/<\/script/gi,'<\\/script');
html=html.replace('</body>',()=>'<script data-tr-desktop-native-storage="0.2.0">'+runtime+'</script>\n</body>');

fs.writeFileSync(indexPath,html);
fs.rmSync(desktopDir+'/_headers',{force:true});

console.log('Prepared offline Desktop 0.2 artifact with native storage runtime -> desktop-dist/');
