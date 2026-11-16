import {C} from './theme.js';
import {div,span} from './dom.js';
import {S,IS_ADMIN,IS_PLAYER,ACCESS,SAVE_ERROR,onChange,loadRemote,startSync} from './store.js';
import {renderDetail} from './views/detail.js';
import {renderHome} from './views/home.js';
import {renderStandings} from './views/standings.js';
import {renderEvents} from './views/events.js';
import {renderPlayers} from './views/players.js';
import {renderSettings} from './views/settings.js';

// ─── Access screen (no key, wrong key, still loading) ─────────
const ACCESS_TEXT={
  loading:['⏳','Lade…',''],
  nokey:['🔑','Zugangs-Key nötig','Bitte den Link mit Key verwenden, den du bekommen hast.'],
  badkey:['🚫','Key ungültig','Dieser Link funktioniert nicht (mehr). Bitte einen aktuellen Link anfordern.'],
};
const renderAccess=()=>{
  const [icon,title,sub]=ACCESS_TEXT[ACCESS];
  const s=div('screen fi');
  const box=div('',{textAlign:'center',paddingTop:'80px'});
  box.appendChild(span(icon,{fontSize:'52px',display:'block',marginBottom:'14px'}));
  box.appendChild(span(title,{fontSize:'20px',fontWeight:'700',color:C.text,display:'block',marginBottom:'8px'}));
  box.appendChild(span(sub,{fontSize:'14px',color:C.sub,display:'block',padding:'0 24px'}));
  s.appendChild(box);return s;
};

// ─── Banners: role, offline, unsaved changes ──────────────────
const updateBanners=()=>{
  const rb=document.getElementById('readonly-banner');
  document.body.classList.toggle('readonly',!IS_PLAYER);
  if(ACCESS==='offline'){rb.style.display='block';rb.style.background='#6B7280';rb.textContent='📡 Offline — letzter bekannter Stand, nur lesen';}
  else if(ACCESS!=='ok'||IS_ADMIN){rb.style.display='none';}
  else if(IS_PLAYER){rb.style.display='block';rb.style.background='#2563EB';rb.textContent='⚽ Spieler-Modus — Events & Scores';}
  else{rb.style.display='block';rb.style.background='#F59E0B';rb.textContent='👁 Zuschauer-Modus — nur lesen';}
  const sb=document.getElementById('save-banner');
  sb.style.display=SAVE_ERROR?'block':'none';
  sb.textContent=SAVE_ERROR||'';
};

// ─── Main render ──────────────────────────────────────────────
export const render=()=>{
  const old=document.getElementById('screen');
  const scrollY=old?old.scrollTop:0;
  updateBanners();
  document.querySelectorAll('.navbtn').forEach(b=>{b.classList.toggle('active',b.dataset.tab==S.tab);});
  let content;
  if(ACCESS!=='ok'&&ACCESS!=='offline') content=renderAccess();
  else if(S.tab===2&&S.selEv) content=renderDetail();
  else if(S.tab===0) content=renderHome();
  else if(S.tab===1) content=renderStandings();
  else if(S.tab===2) content=renderEvents();
  else if(S.tab===3) content=renderPlayers();
  else content=renderSettings();
  content.id='screen';
  document.getElementById('root').replaceChild(content,old);
  content.scrollTop=scrollY;
};

export const setTab=(t)=>{
  if(t!==2)S.selEv=null;
  S.tab=t;render();
};

// ─── Nav ──────────────────────────────────────────────────────
document.querySelectorAll('.navbtn').forEach(b=>b.addEventListener('click',()=>setTab(Number(b.dataset.tab))));
onChange(render);

// ─── Boot ─────────────────────────────────────────────────────
export const ready=(async()=>{
  render();
  await loadRemote();
  render();
  startSync();
})();
