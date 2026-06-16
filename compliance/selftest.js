
const fs=require('fs'); const path=require('path');
const {appendAudit,verifyAudit}=require('./audit');
const {generateSaftXml,parseSaftXml}=require('./saft');
const {generateOioUblInvoice}=require('./oioubl');
const {runBackup}=require('./backup');
const base=path.join(__dirname,'..','test-output'); fs.mkdirSync(base,{recursive:true});
appendAudit(path.join(base,'audit'),{type:'SELFTEST',text:'Hash-chain test'});
const audit=verifyAudit(path.join(base,'audit'));
const saft=generateSaftXml({company:{name:'Demo ApS',cvr:'12345678'},accounts:[{id:'1000',name:'Bank'}],entries:[{id:'1',date:'2026-06-16',text:'Demo',lines:[{account:'1000',debit:100,credit:0}]}]});
fs.writeFileSync(path.join(base,'saft-demo.xml'),saft);
const oio=generateOioUblInvoice({invoiceNo:'F-1',supplier:{name:'Demo',cvr:'12345678'},customer:{name:'Kunde',ean:'5790000000000'},lines:[{text:'Timer',qty:2,unitPrice:400}]});
fs.writeFileSync(path.join(base,'invoice-demo.xml'),oio);
const backup=runBackup({sourceDirs:[path.join(base,'audit')],backupDir:path.join(base,'backups')});
console.log(JSON.stringify({ok:audit.ok,audit,saftImport:parseSaftXml(saft),oioubl:oio.includes('<Invoice'),backup},null,2));
