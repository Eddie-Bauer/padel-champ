// Start: the season leader, and the current Padel Day.
import {h,btn,iconBtn,headline,section,first,dm} from '../dom.js';
import {S,IS_PLAYER,activeSeason,curRnd,matByRnd,getMat,standings,notify} from '../store.js';
import {matchCard,openScoreSheet} from './match.js';
import {eventCard,openNewEvent} from './events.js';

// The one hero card of the screen: who leads the season, in one big number.
const leaderHero=st=>{
  const lead=st[0],second=st[1];
  if(!lead||lead.mp===0)return null;
  const gap=second&&second.mp>0?lead.pct-second.pct:null;
  const sub=gap===null?'Bisher allein in der Wertung.'
    :gap===0?'Gleiche Siegquote wie '+first(second.player.name)+'.'
    :gap+(gap===1?' Prozentpunkt':' Prozentpunkte')+' vor '+first(second.player.name)+'.';
  const stat=(value,label)=>h('div',null,h('b',{text:String(value)}),h('span',{text:label}));
  return h('div',{class:'pc-hero'},
    h('div',{class:'pc-hero__label',text:'Spitzenreiter'}),
    h('div',{class:'pc-herostat__main'},
      h('span',{class:'pc-herostat__num',text:lead.pct+'%'}),
      h('span',{class:'pc-herostat__unit',text:'Siegquote · '+first(lead.player.name)})),
    h('div',{class:'pc-herostat__sub',text:sub}),
    h('div',{class:'pc-herostat__row'},stat(lead.mp,'Spiele'),stat(lead.w,'Siege'),stat(lead.pts,'Punkte')));
};

export const renderHome=()=>{
  const as=activeSeason();
  const evs=S.events.filter(e=>e.sid===as.id).sort((a,b)=>b.date.localeCompare(a.date));
  const latest=evs[0];
  const settingsBtn=iconBtn('ghost','settings','Einstellungen',()=>{S.tab='settings';S.selEv=null;notify();});

  if(!latest){
    return h('main',{class:'app-screen pc-enter'},
      h('div',{class:'app-head'},headline(as.name,null,'PadelChamp'),settingsBtn),
      leaderHero(standings()),
      h('div',{class:'app-empty'},
        h('p',{style:{margin:'0'},text:'Noch kein Padel Day in dieser Saison.'}),
        IS_PLAYER&&btn('primary','Neuer Padel Day',openNewEvent,{icon:'plus'})));
  }

  const cr=curRnd(latest.id);
  const canEdit=IS_PLAYER&&latest.status!=='completed';
  const ms=matByRnd(latest.id,cr);
  return h('main',{class:'app-screen pc-enter'},
    h('div',{class:'app-head'},headline(as.name,'Padel Day ',dm(latest.date)),settingsBtn),
    leaderHero(standings()),
    section('Aktueller Padel Day',null,eventCard(latest)),
    ms.length>0&&section('Runde '+cr,null,
      h('div',{class:'app-list'},ms.map(m=>matchCard(m,canEdit?()=>openScoreSheet(m):null)))),
    getMat(latest.id).length===0&&h('p',{class:'app-note',text:'Noch kein Spielplan.'}));
};
