
const fs=require('fs'); const path=require('path'); const zlib=require('zlib');
function ensure(d){fs.mkdirSync(d,{recursive:true});}
function copyRecursive(src,dst){const st=fs.statSync(src); if(st.isDirectory()){ensure(dst); for(const f of fs.readdirSync(src)) copyRecursive(path.join(src,f),path.join(dst,f));} else {ensure(path.dirname(dst)); fs.copyFileSync(src,dst);}}
function runBackup({sourceDirs=[], backupDir='backups'}={}){
 const stamp=new Date().toISOString().replace(/[:.]/g,'-'); const target=path.join(backupDir,stamp); ensure(target);
 for(const src of sourceDirs){ if(fs.existsSync(src)) copyRecursive(src,path.join(target,path.basename(src))); }
 fs.writeFileSync(path.join(target,'backup-manifest.json'), JSON.stringify({createdAt:new Date().toISOString(),sourceDirs},null,2));
 return {ok:true,target,note:'Lokal backup udført. Til produktion kobles denne til S3/Cloudflare R2/Supabase Storage via miljøvariabler.'};
}
module.exports={runBackup};
