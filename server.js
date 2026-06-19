const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const contacts = [
  { id:'ven-henrik', name:'Henrik Rasmussen', role:'Ven', folder:'venner', phone:'+4510101010', city:'Aalborg', plan:'B2B Netværk', activePeople:1, tags:['hurtig kontakt','video','sms'], status:'ledig' },
  { id:'medarbejder-test001', name:'TEST001 Medarbejder', role:'Medarbejder', folder:'medarbejdere', phone:'+4520202020', city:'København', plan:'B2B Netværk', activePeople:1, tags:['timer','godkendelse','løn'], status:'ledig' },
  { id:'medarbejder-flyt02', name:'Flyttehjælper 02', role:'Medarbejder', folder:'medarbejdere', phone:'+4520203030', city:'Odense', plan:'B2B Netværk', activePeople:1, tags:['flytning','akut','nat'], status:'banker' },
  { id:'kunde-nordflyt', name:'NordFlyt ApS', role:'Kunde', folder:'kunder', phone:'+4511223344', city:'Aalborg', plan:'B2B Netværk', activePeople:3, tags:['flytning','akut hjælp','lager'], status:'ledig' },
  { id:'kunde-cityservice', name:'CityService Vikar', role:'Kunde', folder:'kunder', phone:'+4555667788', city:'København', plan:'B2B Netværk', activePeople:2, tags:['vikarer','rengøring','aften'], status:'ledig' },
  { id:'kunde-byglogistik', name:'BygLogistik Team', role:'Kunde', folder:'kunder', phone:'+4599887766', city:'Odense', plan:'B2B Netværk', activePeople:5, tags:['bæring','byggeplads','transport'], status:'optaget' }
];

app.get('/health', (req,res)=>res.json({ok:true, service:'pengedag-b2b-glass-kontaktbibliotek', version:'1.4.8'}));
app.get('/api/b2b/contacts', (req,res)=>res.json({ok:true, count:contacts.length, contacts}));
app.post('/api/b2b/contacts', (req,res)=>{
  const body=req.body||{};
  const id = body.id || ('kontakt-' + Date.now());
  const contact = { id, name:body.name||'Ny kontakt', role:body.role||'Kunde', folder:body.folder||'kunder', phone:body.phone||'', city:body.city||'', plan:'B2B Netværk', activePeople:Number(body.activePeople||1), tags:body.tags||[], status:'ledig' };
  contacts.push(contact);
  res.json({ok:true, contact});
});
app.get('/api/b2b/pricing', (req,res)=>res.json({ok:true, pricePerPersonDkk:150, model:'150 kr. pr. aktiv B2B-person pr. måned'}));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const rooms = new Map();
function roomState(room){ if(!rooms.has(room)) rooms.set(room,{clients:new Set(), busy:false}); return rooms.get(room); }
function broadcast(room, data, except){
  const state=roomState(room); const msg=JSON.stringify(data);
  for(const c of state.clients){ if(c!==except && c.readyState===WebSocket.OPEN) c.send(msg); }
}
wss.on('connection', ws=>{
  let room='lobby'; let role='guest';
  ws.on('message', raw=>{
    let msg; try{msg=JSON.parse(raw)}catch{return}
    if(msg.type==='join'){
      room=String(msg.room||'lobby'); role=String(msg.role||'guest');
      const st=roomState(room); st.clients.add(ws); ws.room=room; ws.role=role;
      const peerCount=[...st.clients].filter(c=>c.readyState===WebSocket.OPEN).length;
      ws.send(JSON.stringify({type:'joined', room, role, peerCount, busy:st.busy}));
      broadcast(room,{type:'peer-joined', role, peerCount},ws);
      return;
    }
    if(msg.type==='busy'){ roomState(room).busy=!!msg.busy; broadcast(room,{type:'busy', busy:!!msg.busy, by:role},ws); return; }
    if(msg.type==='knock'){ broadcast(room,{type:'knock', from:role, text:msg.text||'Der bankes på'},ws); return; }
    if(['offer','answer','ice','chat','hangup','call-ready'].includes(msg.type)) broadcast(room,msg,ws);
  });
  ws.on('close',()=>{ const st=roomState(room); st.clients.delete(ws); broadcast(room,{type:'peer-left', role},ws); });
});
const PORT = process.env.PORT || 8080;
server.listen(PORT,()=>console.log('Pengedag B2B Video SMS motor on '+PORT));
