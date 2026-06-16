
const fs=require('fs'); const {exportOioUbl}=require('./oioubl');
const inv=JSON.parse(fs.readFileSync(process.argv[2],'utf8')); console.log('OIOUBL written:', exportOioUbl(inv,process.argv[3]||'exports/invoice.xml'));
