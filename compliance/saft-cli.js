
const fs=require('fs'); const path=require('path'); const {exportSaft}=require('./saft');
const src=process.argv[2], out=process.argv[3]||'exports/saft.xml';
const dataFile=path.join(src||'.','saft-data.json');
const data=fs.existsSync(dataFile)?JSON.parse(fs.readFileSync(dataFile,'utf8')):{company:{name:'Demo',cvr:'12345678'},accounts:[],entries:[],attachments:[]};
console.log('SAF-T written:', exportSaft(data,out));
