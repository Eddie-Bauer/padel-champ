import {IS_ADMIN,initAuth,S,onChange,loadRemote,IS_PLAYER} from './store.js';
import {renderDetail} from './views/detail.js';
import {renderHome} from './views/home.js';
import {renderStandings} from './views/standings.js';
import {renderEvents} from './views/events.js';
import {renderPlayers} from './views/players.js';
import {renderSettings} from './views/settings.js';

// ─── Main render ──────────────────────────────────────────────
export const render=()=>{
  const old=document.getElementById('screen');
  const scrollY=old?old.scrollTop:0;
  document.querySelectorAll('.navbtn').forEach(b=>{b.classList.toggle('active',b.dataset.tab==S.tab);});
  let content;
  if(S.tab===2&&S.selEv) content=renderDetail();
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
  await initAuth();
  if(!IS_PLAYER){document.getElementById('readonly-banner').style.display='block';document.body.classList.add('readonly');}
  else if(!IS_ADMIN){document.getElementById('readonly-banner').style.display='block';document.getElementById('readonly-banner').style.background='#2563EB';document.getElementById('readonly-banner').textContent='⚽ Spieler-Modus — Events & Scores';}
  await loadRemote();
  render();
})();
