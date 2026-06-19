const root=document.getElementById('contacts');
const search=document.getElementById('search');
const sort=document.getElementById('sort');
const folderButtons=[...document.querySelectorAll('.folderBtn')];
const folderHeadline=document.getElementById('folderHeadline');
const priceTotal=document.getElementById('priceTotal');
let all=[]; let activeFolder='alle';
const folderNames={alle:'Alle kontakter',venner:'Venner',medarbejdere:'Medarbejdere',kunder:'Kunder'};
function initials(name){return (name||'?').split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();}
function categoryClass(c){ if(c.folder==='venner') return 'purple'; if(c.folder==='medarbejdere') return 'green'; return ''; }
function smsHref(c){ const body=encodeURIComponent(`Hej ${c.name}. Skal vi tage en hurtig Pengedag-snak?`); return `sms:${c.phone||''}?body=${body}`; }
function filtered(){
  const q=(search.value||'').toLowerCase().trim();
  let list=all.filter(c=> activeFolder==='alle' || c.folder===activeFolder);
  if(q) list=list.filter(c=>[c.name,c.city,c.role,c.folder,...(c.tags||[])].join(' ').toLowerCase().includes(q));
  const mode=sort.value;
  list.sort((a,b)=> mode==='price' ? ((b.activePeople||1)*150)-((a.activePeople||1)*150) : mode==='status' ? String(a.status).localeCompare(String(b.status),'da') : String(a.name).localeCompare(String(b.name),'da'));
  return list;
}
function updateCounts(){
  const by=f=>all.filter(c=>f==='alle'||c.folder===f).length;
  document.getElementById('countAlle').textContent=by('alle')+' personer';
  document.getElementById('countVenner').textContent=by('venner')+' personer';
  document.getElementById('countMedarbejdere').textContent=by('medarbejdere')+' personer';
  document.getElementById('countKunder').textContent=by('kunder')+' personer';
}
function render(){
  const list=filtered(); root.innerHTML=''; folderHeadline.textContent=folderNames[activeFolder];
  priceTotal.textContent=list.reduce((sum,c)=>sum+(Number(c.activePeople||1)*150),0).toLocaleString('da-DK')+' kr.';
  updateCounts();
  if(!list.length){ root.innerHTML='<div class="card glass span12 empty">Ingen kontakter i denne mappe endnu.</div>'; return; }
  list.forEach(c=>{
    const el=document.createElement('div'); el.className='card glass span6';
    const statusClass=c.status==='optaget'?'optaget':(c.status==='banker'?'banker':'ledig');
    el.innerHTML=`<div class="contact"><div class="contactLeft"><div class="avatar">${initials(c.name)}</div><div><span class="pill ${categoryClass(c)}">${folderNames[c.folder]||c.role}</span><h2>${c.name}</h2><p class="muted">${c.city||'Ukendt by'} · ${c.role||'Kontakt'} · ${c.activePeople||1} aktiv(e) · ${(150*(c.activePeople||1)).toLocaleString('da-DK')} kr./md.</p><div class="tags">${(c.tags||[]).map(t=>`<span class="tag">${t}</span>`).join('')}</div></div></div><span class="status ${statusClass}">${c.status||'ledig'}</span></div><div class="toolbar"><a class="btn glow" href="owner.html?room=${encodeURIComponent(c.id)}">Start video</a><a class="btn ghost" href="${smsHref(c)}">Send SMS</a><a class="btn ghost" href="owner.html?room=${encodeURIComponent(c.id)}&knock=1">Bank på</a></div>`;
    root.appendChild(el);
  });
}
folderButtons.forEach(btn=>btn.addEventListener('click',()=>{ activeFolder=btn.dataset.folder; folderButtons.forEach(b=>b.classList.toggle('active',b===btn)); render(); }));
search.addEventListener('input',render); sort.addEventListener('change',render);
fetch('/api/b2b/contacts').then(r=>r.json()).then(d=>{ all=(d.contacts||[]).map(c=>({...c, folder:c.folder || (c.role==='Medarbejder'?'medarbejdere':c.role==='Ven'?'venner':'kunder')})); render(); }).catch(()=>{ all=[]; render(); });
