require('dotenv').config();
const express=require('express');const cors=require('cors');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const multer=require('multer');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const {appendAudit,verifyAudit}=require('./compliance/audit');const {generateSaftXml,parseSaftXml}=require('./compliance/saft');const {generateOioUblInvoice}=require('./compliance/oioubl');const {storeAttachment}=require('./compliance/storage');const {runBackup}=require('./compliance/backup');
const app=express();const PORT=process.env.PORT||8080;const SECRET=process.env.JWT_SECRET||'dev';const uploadDir=process.env.UPLOAD_DIR||'uploads';const auditDir=process.env.AUDIT_LOG_DIR||'audit-log';const attachmentDir=process.env.ATTACHMENT_DIR||'attachments';const backupDir=process.env.BACKUP_DIR||'backups';fs.mkdirSync(uploadDir,{recursive:true});fs.mkdirSync(auditDir,{recursive:true});fs.mkdirSync(attachmentDir,{recursive:true});
const upload=multer({dest:uploadDir, limits:{fileSize:50*1024*1024}});
let users=[];let licenses={};let mobileEntries=[];let employeePayslips={};let overtimeRules={default:{overtimeAuto:'ja',overtimeMode:'daily',overtimeDailyAfter:7.5,overtimeWeeklyAfter:37,overtimeRound:0.25,standardOvertidTimeloen:220,updatedAt:new Date().toISOString()}};
app.use(cors());
app.use('/api/stripe/webhook', express.raw({type:'application/json'}));
app.use(express.json({limit:'2mb'}));
function tokenFor(u){return jwt.sign({email:u.email},SECRET,{expiresIn:'30d'})}
function auth(req,res,next){const h=req.headers.authorization||'';try{req.user=jwt.verify(h.replace('Bearer ',''),SECRET);next()}catch(e){res.status(401).json({ok:false,error:'unauthorized'})}}
app.get('/',(req,res)=>res.json({ok:true,app:'Pengedag Backend',version:'1.1.3',note:'Godkendelses-klar backend-skabelon. Brug /health til Railway.'}));
app.get('/health',(req,res)=>res.json({ok:true,app:'Pengedag Backend',version:'1.1.3'}));
app.post('/api/register', async(req,res)=>{const {email,password}=req.body;if(!email||!password)return res.status(400).json({ok:false,error:'email/password'});if(users.find(u=>u.email===email))return res.status(409).json({ok:false,error:'exists'});const user={email,passwordHash:await bcrypt.hash(password,10),createdAt:new Date().toISOString()};users.push(user);licenses[email]={status:'trial',trialStart:Date.now(),trialEnds:Date.now()+183*24*3600*1000,paidUntil:null};res.json({ok:true,token:tokenFor(user),license:licenses[email]})});
app.post('/api/login', async(req,res)=>{const u=users.find(x=>x.email===req.body.email);if(!u||!await bcrypt.compare(req.body.password||'',u.passwordHash))return res.status(401).json({ok:false,error:'bad_login'});res.json({ok:true,token:tokenFor(u),license:licenses[u.email]})});
app.get('/api/license',auth,(req,res)=>{const l=licenses[req.user.email]||null;res.json({ok:true,license:l})});
app.post('/api/revisor/upload',auth,upload.single('zip'),(req,res)=>{res.json({ok:true,file:req.file?.filename,original:req.file?.originalname,size:req.file?.size})});
app.post('/api/stripe/webhook',(req,res)=>{console.log('Stripe webhook received. Add signature verification before production.');res.json({received:true})});


function mobileOk(req){
  const secret=process.env.MOBILE_SHARED_SECRET||'';
  return !secret || req.headers['x-mobile-secret']===secret || req.query.secret===secret;
}
function num(v){ return Number(String(v ?? '').replace(',','.')) || 0; }
function clockHours(startTime,endTime,breakMinutes=0){
  if(!startTime || !endTime) return 0;
  const [sh,sm]=String(startTime).split(':').map(Number);
  const [eh,em]=String(endTime).split(':').map(Number);
  if(Number.isNaN(sh)||Number.isNaN(sm)||Number.isNaN(eh)||Number.isNaN(em)) return 0;
  let mins=(eh*60+em)-(sh*60+sm);
  if(mins<0) mins+=24*60;
  mins-=num(breakMinutes);
  return Math.max(0, Math.round((mins/60)*100)/100);
}
function roundTo(v, step=0.25){ step=num(step)||0.25; return Math.max(0, Math.round(num(v)/step)*step); }
function calcOvertime(hours, rules){
  rules=rules||overtimeRules.default;
  if(rules.overtimeAuto==='nej' || rules.overtimeMode==='none') return 0;
  if(rules.overtimeMode==='weekly') return 0; // uge-overtid slutberegnes bedst i desktop ved godkendelse
  return Math.min(hours, roundTo(Math.max(0, hours-num(rules.overtimeDailyAfter||7.5)), rules.overtimeRound||0.25));
}
function calculateMobileEntry(e){
  const breakMinutes=num(e.pauseMinutes ?? e.breakMinutes ?? 0);
  const fromClock=clockHours(e.startTime,e.endTime,breakMinutes);
  const hours=fromClock>0 ? fromClock : num(e.hours);
  const rules=overtimeRules[String(e.employeeId||'default')]||overtimeRules.default;
  const overtimeHours=(e.overtimeHours!==undefined && e.overtimeHours!==null && e.overtimeHours!=='') ? Math.min(hours,num(e.overtimeHours)) : calcOvertime(hours,rules);
  const normalHours=Math.max(0, hours-overtimeHours);
  const normalRate=num(e.normalRate || e.timeloen || process.env.DEFAULT_NORMAL_RATE || 160);
  const overtimeRate=num(e.overtimeRate || e.overtidTimeloen || rules.standardOvertidTimeloen || process.env.DEFAULT_OVERTIME_RATE || 220);
  const customerRate=num(e.customerRate || process.env.DEFAULT_CUSTOMER_RATE || 320);
  const vatRate=num(e.vatRate || process.env.DEFAULT_VAT_RATE || 25);
  const normalPay=normalHours*normalRate;
  const overtimePay=overtimeHours*overtimeRate;
  const employeePay=normalPay+overtimePay;
  const customerTotalExVat=hours*customerRate;
  const customerVat=customerTotalExVat*vatRate/100;
  const customerTotalIncVat=customerTotalExVat+customerVat;
  const marginExVat=customerTotalExVat-employeePay;
  return {hours,normalHours,overtimeHours,normalRate,overtimeRate,customerRate,vatRate,normalPay,overtimePay,employeePay,customerTotalExVat,customerVat,customerTotalIncVat,marginExVat};
}
function normalizeMobileEntry(e){
  const calc=calculateMobileEntry(e||{});
  return {
    id:e.id||('mob_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)),
    employeeId:String(e.employeeId||''), employeeName:e.employeeName||'', email:e.email||'',
    customerId:e.customerId||'', customerName:e.customerName||'', jobId:e.jobId||'',
    date:e.date||new Date().toISOString().slice(0,10), startTime:e.startTime||'', endTime:e.endTime||'',
    pauseMinutes:num(e.pauseMinutes ?? e.breakMinutes ?? 0), breakMinutes:num(e.pauseMinutes ?? e.breakMinutes ?? 0),
    note:e.note||'', status:e.status==='Lokal'?'Afventer':(e.status||'Afventer'),
    createdAt:e.createdAt||new Date().toISOString(), updatedAt:new Date().toISOString(),
    hours:calc.hours, normalHours:calc.normalHours, overtimeHours:calc.overtimeHours, calculation:calc
  };
}
function getMobileEntries(req,res){
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const status=req.query.status;
  const entries=status?mobileEntries.filter(e=>e.status===status):mobileEntries;
  res.json({ok:true,count:entries.length,entries});
}
function postMobileEntry(req,res){
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const e=req.body||{};
  if(!e.employeeId) return res.status(400).json({ok:false,error:'employeeId_required'});
  const entry=normalizeMobileEntry(e);
  mobileEntries.push(entry);
  res.json({ok:true,entry});
}

app.get('/api/mobile/routes',(req,res)=>res.json({ok:true,version:'1.1.3',routes:['GET /api/mobile/time-entries','GET /api/mobile/times','GET /api/mobile/timesheets','GET /api/mobile/entries','POST /api/mobile/time-entry','POST /api/mobile/time-entries','POST /api/mobile/times','POST /api/mobile/timesheets','POST /api/mobile/entries']}));
app.post('/api/mobile/overtime-rules',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  overtimeRules.default={...overtimeRules.default,...(req.body||{}),updatedAt:new Date().toISOString()};
  res.json({ok:true,rules:overtimeRules.default});
});
app.post('/api/mobile/overtime-rules/:employeeId',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const id=String(req.params.employeeId||'default');
  overtimeRules[id]={...overtimeRules.default,...(req.body||{}),employeeId:id,updatedAt:new Date().toISOString()};
  res.json({ok:true,rules:overtimeRules[id]});
});
app.get('/api/mobile/overtime-rules/:employeeId',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const id=String(req.params.employeeId||'default');
  res.json({ok:true,rules:overtimeRules[id]||overtimeRules.default});
});

['/api/mobile/time-entries','/api/mobile/times','/api/mobile/timesheets','/api/mobile/entries'].forEach(route=>app.get(route,getMobileEntries));
['/api/mobile/time-entry','/api/mobile/time-entries','/api/mobile/times','/api/mobile/timesheets','/api/mobile/entries'].forEach(route=>app.post(route,postMobileEntry));

app.post('/api/mobile/time-entry/:id/status',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const e=mobileEntries.find(x=>x.id===req.params.id);
  if(!e) return res.status(404).json({ok:false,error:'not_found'});
  e.status=req.body.status||e.status;e.updatedAt=new Date().toISOString();
  res.json({ok:true,entry:e});
});
app.post('/api/mobile/time-entries/:id/approve',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const e=mobileEntries.find(x=>x.id===req.params.id);
  if(!e) return res.status(404).json({ok:false,error:'not_found'});
  e.status='Godkendt'; e.approvedAt=new Date().toISOString(); e.updatedAt=new Date().toISOString();
  res.json({ok:true,entry:e});
});
app.post('/api/mobile/payslip/publish',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const p=req.body||{};
  if(!p.employeeId) return res.status(400).json({ok:false,error:'employeeId_required'});
  employeePayslips[String(p.employeeId)]=[{...p,publishedAt:new Date().toISOString()},...(employeePayslips[String(p.employeeId)]||[])].slice(0,24);
  res.json({ok:true,count:employeePayslips[String(p.employeeId)].length});
});
app.get('/api/mobile/payslip/:employeeId',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  res.json({ok:true,payslips:employeePayslips[String(req.params.employeeId)]||[]});
});

app.post('/api/email/send', express.json({limit:'1mb'}), (req,res)=>{
  // SMTP/API-skabelon: indsæt fx Resend, SendGrid, Mailgun eller egen SMTP her.
  // Desktop-appen bruger indtil videre mailto, så brugeren kan sende via sit mailprogram.
  const {to, subject, body} = req.body || {};
  console.log('EMAIL_REQUEST', {to, subject, bodyPreview:String(body||'').slice(0,120)});
  res.json({ok:true, mode:'mock', note:'E-mail endpoint klar. Tilføj SMTP/API-nøgle for rigtig automatisk afsendelse.'});
});



// Compliance endpoints - v1.1 GodkendelsesKlar+
app.post('/api/compliance/audit', auth, (req,res)=>{
  const rec=appendAudit(auditDir,{actor:req.user.email,type:req.body.type||'CHANGE',entity:req.body.entity||'',entityId:req.body.entityId||'',before:req.body.before||null,after:req.body.after||null,reason:req.body.reason||''});
  res.json({ok:true,record:rec});
});
app.get('/api/compliance/audit/verify', auth, (req,res)=>res.json(verifyAudit(auditDir)));
app.post('/api/compliance/attachment', auth, upload.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).json({ok:false,error:'file_required'});
  const rec=storeAttachment(req.file.path,{id:req.body.id,originalName:req.file.originalname,date:req.body.date,type:req.body.type},attachmentDir);
  appendAudit(auditDir,{actor:req.user.email,type:'ATTACHMENT_STORED',entity:'attachment',entityId:rec.id,after:rec});
  res.json({ok:true,attachment:rec});
});
app.post('/api/compliance/saft/export', auth, (req,res)=>{
  const xml=generateSaftXml(req.body||{});
  appendAudit(auditDir,{actor:req.user.email,type:'SAFT_EXPORT',entity:'saft',after:{bytes:Buffer.byteLength(xml)}});
  res.type('application/xml').send(xml);
});
app.post('/api/compliance/saft/import', auth, (req,res)=>{
  const result=parseSaftXml(req.body.xml||'');
  appendAudit(auditDir,{actor:req.user.email,type:'SAFT_IMPORT_DRYRUN',entity:'saft',after:{count:result.entries?.length||0}});
  res.json(result);
});
app.post('/api/compliance/oioubl/invoice', auth, (req,res)=>{
  const xml=generateOioUblInvoice(req.body||{});
  appendAudit(auditDir,{actor:req.user.email,type:'OIOUBL_INVOICE_EXPORT',entity:'invoice',entityId:req.body.invoiceNo||'',after:{bytes:Buffer.byteLength(xml)}});
  res.type('application/xml').send(xml);
});
app.post('/api/compliance/backup/run', auth, (req,res)=>{
  const result=runBackup({sourceDirs:[uploadDir,attachmentDir,auditDir],backupDir});
  appendAudit(auditDir,{actor:req.user.email,type:'BACKUP_RUN',entity:'backup',after:result});
  res.json(result);
});

app.listen(PORT,'0.0.0.0',()=>console.log('Pengedag backend on '+PORT));
