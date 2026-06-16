
const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
function ensure(dir){fs.mkdirSync(dir,{recursive:true});}
function shaFile(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
function storeAttachment(srcFile, meta={}, baseDir='attachments'){
 ensure(baseDir);
 const hash=shaFile(srcFile); const ext=path.extname(srcFile).toLowerCase();
 const date=(meta.date||new Date().toISOString().slice(0,10)).replaceAll('-','/');
 const dir=path.join(baseDir,date); ensure(dir);
 const target=path.join(dir,`${hash}${ext}`);
 if(!fs.existsSync(target)) fs.copyFileSync(srcFile,target);
 const index=path.join(baseDir,'attachment-index.jsonl');
 const record={id:meta.id||hash.slice(0,12),originalName:meta.originalName||path.basename(srcFile),path:target,sha256:hash,date:meta.date||new Date().toISOString().slice(0,10),type:meta.type||'BILAG',createdAt:new Date().toISOString()};
 fs.appendFileSync(index,JSON.stringify(record)+'\n');
 return record;
}
module.exports={storeAttachment,shaFile};
