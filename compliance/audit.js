
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function sha256(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function stable(obj){ return JSON.stringify(obj, Object.keys(obj).sort(), 2); }
function logFile(dir){ ensureDir(dir); return path.join(dir,'audit-ledger.jsonl'); }
function getLastHash(dir){
  const file=logFile(dir); if(!fs.existsSync(file)) return 'GENESIS';
  const lines=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean);
  if(!lines.length) return 'GENESIS';
  try{return JSON.parse(lines[lines.length-1]).hash || 'GENESIS';}catch(e){return 'CORRUPT';}
}
function appendAudit(dir, event){
  const prevHash=getLastHash(dir);
  const record={
    seq: Date.now()+'-'+crypto.randomBytes(4).toString('hex'),
    timestamp:new Date().toISOString(),
    prevHash,
    event
  };
  record.hash=sha256(stable({seq:record.seq,timestamp:record.timestamp,prevHash,event}));
  fs.appendFileSync(logFile(dir), JSON.stringify(record)+'\n');
  return record;
}
function verifyAudit(dir){
  const file=logFile(dir); if(!fs.existsSync(file)) return {ok:true,count:0};
  const lines=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean);
  let prev='GENESIS';
  for(let i=0;i<lines.length;i++){
    let r; try{r=JSON.parse(lines[i]);}catch(e){return {ok:false,error:'invalid_json',line:i+1};}
    const expected=sha256(stable({seq:r.seq,timestamp:r.timestamp,prevHash:r.prevHash,event:r.event}));
    if(r.prevHash!==prev) return {ok:false,error:'prev_hash_mismatch',line:i+1};
    if(r.hash!==expected) return {ok:false,error:'hash_mismatch',line:i+1};
    prev=r.hash;
  }
  return {ok:true,count:lines.length,lastHash:prev};
}
module.exports={appendAudit,verifyAudit,sha256};
