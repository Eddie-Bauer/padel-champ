import {h,icon,btn,headline} from './dom.js';
import {S,IS_PLAYER,ACCESS,SAVE_ERROR,getEv,onChange,loadRemote,startSync,flush} from './store.js';
import {renderDetail} from './views/detail.js';
import {nextOpenMatch} from './views/event-parts.js';
import {renderHome} from './views/home.js';
import {renderStandings} from './views/standings.js';
import {renderEvents,openNewEvent} from './views/events.js';
import {renderPlayers} from './views/players.js';
import {renderSettings} from './views/settings.js';
import {openScoreSheet} from './views/match.js';

// ─── Access screen (no key, wrong key, still loading) ─────────
const ACCESS_TEXT={
  loading:['Einen Moment','Lade','Die Daten werden geholt.'],
  nokey:['Kein Zugang','Zugangs-Key nötig','Bitte den Link mit Key verwenden, den du bekommen hast.'],
  badkey:['Kein Zugang','Key ungültig','Dieser Link funktioniert nicht (mehr). Bitte einen aktuellen Link anfordern.'],
};
const renderAccess=()=>{
  const [overline,title,text]=ACCESS_TEXT[ACCESS];
  return h('main',{class:'app-screen pc-enter'},
    h('div',{class:'app-head'},headline(overline,null,title)),
    h('p',{class:'pc-muted',style:{margin:'0'},text}));
};

// ─── Banner: at most one, the most urgent ─────────────────────
const updateBanner=()=>{
  const el=document.getElementById('banner');
  let cls=null,kids=null;
  if(SAVE_ERROR){
    cls='pc-banner--danger';
    kids=['Speichern fehlgeschlagen. Neuer Versuch läuft.',btn('ghost','Erneut',()=>flush(),{cls:'pc-banner__action'})];
  }else if(ACCESS==='offline'){
    cls='pc-banner--warn';kids=[icon('lock'),'Offline: letzter bekannter Stand, nur lesen.'];
  }else if(ACCESS==='ok'&&!IS_PLAYER){
    cls='pc-banner--warn';kids=[icon('lock'),'Nur lesen: Du siehst den Live View.'];
  }
  el.hidden=!cls;
  el.className='pc-banner'+(cls?' '+cls:'');
  el.replaceChildren(...(kids||[]));
};

// ─── The + in the tab bar ─────────────────────────────────────
// Inside a running Padel Day it enters the next open result; everywhere
// else it creates a new Padel Day.
const fabAction=()=>{
  const ev=S.tab==='events'&&S.selEv?getEv():null;
  const next=ev&&ev.status!=='completed'?nextOpenMatch(ev.id):null;
  return next?{label:'Ergebnis eintragen',run:()=>openScoreSheet(next)}:{label:'Neues Event',run:openNewEvent};
};

// ─── Main render ──────────────────────────────────────────────
const SCREENS={start:renderHome,standings:renderStandings,events:renderEvents,players:renderPlayers,settings:renderSettings};
// What a viewer may open: the tab bar shows only Start and Rangliste.
const VIEWER_TABS=['start','standings','settings'];

export const render=()=>{
  const old=document.getElementById('screen');
  const scrollY=old?old.scrollTop:0;
  const locked=ACCESS!=='ok'&&ACCESS!=='offline';
  document.body.classList.toggle('pc-readonly',!IS_PLAYER);
  document.getElementById('root').classList.toggle('app--locked',locked);
  updateBanner();
  if(!IS_PLAYER&&!VIEWER_TABS.includes(S.tab)&&!S.selEv)S.tab='start';
  document.querySelectorAll('.pc-tab').forEach(b=>{
    if(b.dataset.tab===S.tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  document.getElementById('fab').setAttribute('aria-label',fabAction().label);

  let content;
  if(locked)content=renderAccess();
  else if(S.tab==='events'&&S.selEv)content=renderDetail();
  else content=(SCREENS[S.tab]||renderHome)();
  content.id='screen';
  document.getElementById('root').replaceChild(content,old);
  content.scrollTop=scrollY;
};

export const setTab=(t)=>{
  S.selEv=null;S.sub=null;
  S.tab=t;render();
  const screen=document.getElementById('screen');if(screen)screen.scrollTop=0;
};

// ─── Nav ──────────────────────────────────────────────────────
document.querySelectorAll('.pc-tab').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
document.getElementById('fab').addEventListener('click',()=>fabAction().run());
onChange(render);

// ─── Boot ─────────────────────────────────────────────────────
export const ready=(async()=>{
  render();
  await loadRemote();
  render();
  startSync();
})();
