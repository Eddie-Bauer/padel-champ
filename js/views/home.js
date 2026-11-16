// Start: the season leader, and the current Padel Day.
import {h,btn,iconBtn,headline,section,first,dm} from '../dom.js';
import {S,IS_PLAYER,activeSeason,curRnd,matByRnd,getMat,standings,notify,minMatches} from '../store.js';
import {eventCard,openNewEvent} from './events.js';
import {FORMAT_LABEL,formatOf,eventMatchCard} from './event-parts.js';

// The one hero card of the screen: who leads the season, in one big number.
const leaderHero=st=>{
  const lead=st[0],second=st[1];
  if(!lead||lead.mp===0)return null;
  // Before anyone has the minimum, the leader is only provisional.
  const rival=second&&second.mp>0&&second.qualified===lead.qualified?second:null;
  const gap=rival?lead.pct-rival.pct:null;
  const sub=!lead.qualified?'Vorläufig: Noch niemand hat '+minMatches()+' Spiele.'
    :gap===null?'Bisher allein in der Wertung.'
    :gap===0?'Gleiche Siegquote wie '+first(rival.player.name)+'.'
    :gap+(gap===1?' Prozentpunkt':' Prozentpunkte')+' vor '+first(rival.player.name)+'.';
  const stat=(value,label)=>h('div',null,h('b',{text:String(value)}),h('span',{text:label}));
  return h('div',{class:'pc-hero'},
    h('div',{class:'pc-hero__label',text:lead.qualified?'Spitzenreiter':'Vorläufig vorn'}),
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
        h('p',{style:{margin:'0'},text:'Noch kein Event in dieser Saison.'}),
        IS_PLAYER&&btn('primary','Neues Event',openNewEvent,{icon:'plus'})));
  }

  // A Padel Day shows its current round; a tournament its next open matches.
  const padelDay=formatOf(latest)==='padel_day';
  const cr=curRnd(latest.id);
  const ms=padelDay?matByRnd(latest.id,cr)
    :getMat(latest.id).filter(m=>m.status!=='completed').sort((a,b)=>a.rnd-b.rnd||a.seq-b.seq).slice(0,3);
  return h('main',{class:'app-screen pc-enter'},
    h('div',{class:'app-head'},headline(as.name,FORMAT_LABEL[formatOf(latest)]+' ',dm(latest.date)),settingsBtn),
    leaderHero(standings()),
    section('Aktuelles Event',null,eventCard(latest)),
    ms.length>0&&section(padelDay?'Runde '+cr:'Nächste Matches',null,
      h('div',{class:'app-list'},ms.map(m=>eventMatchCard(latest,m)))),
    getMat(latest.id).length===0&&h('p',{class:'app-note',text:'Noch kein Spielplan.'}));
};
