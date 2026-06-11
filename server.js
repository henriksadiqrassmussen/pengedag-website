require('dotenv').config();
const express=require('express');const cors=require('cors');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const multer=require('multer');const fs=require('fs');const path=require('path');
const app=express();const PORT=process.env.PORT||8080;const SECRET=process.env.JWT_SECRET||'dev';const uploadDir=process.env.UPLOAD_DIR||'uploads';fs.mkdirSync(uploadDir,{recursive:true});
const upload=multer({dest:uploadDir, limits:{fileSize:50*1024*1024}});
let users=[];let licenses={};let mobileEntries=[];let employeePayslips={};let overtimeRules={default:{overtimeAuto:'ja',overtimeMode:'daily',overtimeDailyAfter:7.5,overtimeWeeklyAfter:37,overtimeRound:0.25,standardOvertidTimeloen:220,updatedAt:new Date().toISOString()}};
app.use(cors());
app.use('/api/stripe/webhook', express.raw({type:'application/json'}));
app.use(express.json({limit:'2mb'}));
function tokenFor(u){return jwt.sign({email:u.email},SECRET,{expiresIn:'30d'})}
function auth(req,res,next){const h=req.headers.authorization||'';try{req.user=jwt.verify(h.replace('Bearer ',''),SECRET);next()}catch(e){res.status(401).json({ok:false,error:'unauthorized'})}}
app.get('/health',(req,res)=>res.json({ok:true,app:'Pengedag Backend',version:'0.5.1'}));
app.post('/api/register', async(req,res)=>{const {email,password}=req.body;if(!email||!password)return res.status(400).json({ok:false,error:'email/password'});if(users.find(u=>u.email===email))return res.status(409).json({ok:false,error:'exists'});const user={email,passwordHash:await bcrypt.hash(password,10),createdAt:new Date().toISOString()};users.push(user);licenses[email]={status:'trial',trialStart:Date.now(),trialEnds:Date.now()+183*24*3600*1000,paidUntil:null};res.json({ok:true,token:tokenFor(user),license:licenses[email]})});
app.post('/api/login', async(req,res)=>{const u=users.find(x=>x.email===req.body.email);if(!u||!await bcrypt.compare(req.body.password||'',u.passwordHash))return res.status(401).json({ok:false,error:'bad_login'});res.json({ok:true,token:tokenFor(u),license:licenses[u.email]})});
app.get('/api/license',auth,(req,res)=>{const l=licenses[req.user.email]||null;res.json({ok:true,license:l})});
app.post('/api/revisor/upload',auth,upload.single('zip'),(req,res)=>{res.json({ok:true,file:req.file?.filename,original:req.file?.originalname,size:req.file?.size})});
app.post('/api/stripe/webhook',(req,res)=>{console.log('Stripe webhook received. Add signature verification before production.');res.json({received:true})});


function mobileOk(req){
  const secret=process.env.MOBILE_SHARED_SECRET||'';
  return !secret || req.headers['x-mobile-secret']===secret || req.query.secret===secret;
}

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

app.post('/api/mobile/time-entry',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const e=req.body||{};
  if(!e.employeeId) return res.status(400).json({ok:false,error:'employeeId_required'});
  const entry={id:e.id||('mob_'+Date.now()+'_'+Math.random().toString(36).slice(2,7)),employeeId:String(e.employeeId),employeeName:e.employeeName||'',email:e.email||'',date:e.date||new Date().toISOString().slice(0,10),startTime:e.startTime||'',endTime:e.endTime||'',breakMinutes:Number(e.breakMinutes||0),hours:Number(e.hours||0),normalHours:Number(e.normalHours||Math.max(0,Number(e.hours||0)-Number(e.overtimeHours||0))),overtimeHours:Number(e.overtimeHours||0),overtimeRule:e.overtimeRule||null,note:e.note||'',status:'Indsendt',submittedAt:new Date().toISOString()};
  mobileEntries.push(entry);
  res.json({ok:true,entry});
});
app.get('/api/mobile/time-entries',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const status=req.query.status;
  const entries=status?mobileEntries.filter(e=>e.status===status):mobileEntries;
  res.json({ok:true,entries});
});
app.post('/api/mobile/time-entry/:id/status',(req,res)=>{
  if(!mobileOk(req)) return res.status(401).json({ok:false,error:'bad_mobile_secret'});
  const e=mobileEntries.find(x=>x.id===req.params.id);
  if(!e) return res.status(404).json({ok:false,error:'not_found'});
  e.status=req.body.status||e.status;e.updatedAt=new Date().toISOString();
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

app.listen(PORT,()=>console.log('Pengedag backend on '+PORT));
