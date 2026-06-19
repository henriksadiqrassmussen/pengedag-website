const params=new URLSearchParams(location.search), room=params.get('room')||'b2b-demo';
document.getElementById('roomName').textContent=room;
const signal=document.getElementById('signal'), logEl=document.getElementById('log');
let ws, pc, localStream; const cfg={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
function log(t){ logEl.textContent=t; }
function glow(on=true){ document.getElementById('startBtn').classList.toggle('glow',on); }
function wsUrl(){ return (location.protocol==='https:'?'wss://':'ws://')+location.host; }
async function init(){
  localStream=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); document.getElementById('localVideo').srcObject=localStream;
  pc=new RTCPeerConnection(cfg); localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
  pc.ontrack=e=>{ document.getElementById('remoteVideo').srcObject=e.streams[0]; signal.textContent='forbindelse opnået'; signal.classList.add('ok'); glow(false); document.getElementById('knockBtn').classList.add('glow'); log('Forbindelse opnået. Video er klar.'); };
  pc.onicecandidate=e=>{ if(e.candidate) send({type:'ice', candidate:e.candidate}); };
  ws=new WebSocket(wsUrl()); ws.onopen=()=>send({type:'join',room,role:'b2b'}); ws.onmessage=async ev=>{ const m=JSON.parse(ev.data); if(m.type==='joined'){ signal.textContent='klar'; log(m.busy?'Rummet er optaget. Du kan banke på.':'Klar til forbindelse.'); if(params.get('knock')) send({type:'knock',text:'B2B kontakt banker på'}); }
    if(m.type==='peer-joined'){ const offer=await pc.createOffer(); await pc.setLocalDescription(offer); send({type:'offer',offer}); log('Kontakt fundet. Sender forbindelse…'); }
    if(m.type==='offer'){ await pc.setRemoteDescription(m.offer); const ans=await pc.createAnswer(); await pc.setLocalDescription(ans); send({type:'answer',answer:ans}); }
    if(m.type==='answer'){ await pc.setRemoteDescription(m.answer); }
    if(m.type==='ice'&&m.candidate){ try{await pc.addIceCandidate(m.candidate)}catch{} }
    if(m.type==='knock'){ signal.textContent='Der bankes på'; signal.classList.remove('ok'); document.getElementById('startBtn').classList.add('glow'); log(m.text||'Der bankes på.'); }
    if(m.type==='busy') log(m.busy?'Kontakt er optaget. Brug Bank på.':'Kontakt er ledig igen.');
    if(m.type==='hangup'){ log('Opkald afsluttet af kontakt.'); signal.textContent='afsluttet'; }
  };
}
function send(o){ if(ws&&ws.readyState===1) ws.send(JSON.stringify({...o,room})); }
document.getElementById('startBtn').onclick=()=>init().catch(e=>log('Kamera/mikrofon kræver HTTPS og tilladelse. '+e.message));
document.getElementById('knockBtn').onclick=()=>{ if(!ws) init().then(()=>setTimeout(()=>send({type:'knock',text:'B2B kontakt banker på'}),500)); else send({type:'knock',text:'B2B kontakt banker på'}); log('Du har banket på.'); };
document.getElementById('busyBtn').onclick=()=>{ send({type:'busy',busy:true}); log('Du er markeret optaget.'); };
document.getElementById('hangupBtn').onclick=()=>{ send({type:'hangup'}); if(pc) pc.close(); signal.textContent='afsluttet'; log('Opkald afsluttet.'); };
