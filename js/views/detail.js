// One event. A Padel Day is drawn here; tournaments have their own files.
import {h,btn,first} from '../dom.js';
import {S,IS_PLAYER,getEP,getTeams,curRnd,matByRnd,teamByRnd,rndDone,getEv} from '../store.js';
import {genTeams,genMatches} from '../actions.js';
import {teamLabel} from './match.js';
import {openTeamBuilder} from './teambuilder.js';
import {renderEvents} from './events.js';
import {formatOf,eventHead,overlineOf,rosterSection,eventSection,eventMatchCard} from './event-parts.js';
import {renderAmericano} from './americano.js';
import {renderClassic} from './classic.js';

const renderPadelDay=ev=>{
  const ep=getEP(ev.id),cr=curRnd(ev.id);
  const rounds=[...new Set(getTeams(ev.id).map(t=>t.rnd))].sort((a,b)=>a-b);
  const canEdit=IS_PLAYER&&ev.status!=='completed';

  const roster=rosterSection(ev,cr>0||!canEdit,
    cr>0?'Die Teilnehmer stehen seit Runde 1 fest.':ep.length<2?'Mindestens 2 Spieler wählen.':null);

  const start=cr===0&&ep.length>=2&&canEdit&&h('div',{class:'pc-card app-pad app-section'},
    h('div',{class:'title-3',text:'Bereit zum Starten'}),
    h('p',{class:'app-note pc-num',text:ep.length+' Spieler'+(ep.length%2!==0?' · einer hat pro Runde Pause':'')}),
    h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
      btn('primary','Teams mischen',()=>genTeams(ev.id,1),{icon:'shuffle'}),
      btn('secondary','Manuell',()=>openTeamBuilder(ev.id,1))));

  const roundBlocks=rounds.map(rnd=>{
    const teams=teamByRnd(ev.id,rnd),ms=matByRnd(ev.id,rnd);
    const complete=rndDone(ev.id,rnd),isCurrent=rnd===cr;
    const doneCnt=ms.filter(m=>m.status==='completed').length;
    const byeId=(S.byeMap[ev.id]||{})[rnd]||null;
    const byeP=byeId&&S.players.find(p=>p.id===byeId);
    const noSchedule=ms.length===0;
    return h('section',{class:'app-section'},
      h('div',{class:'app-section__head'},
        h('h2',{class:'title-2',text:'Runde '+rnd}),
        ms.length>0&&h('span',{class:'pc-badge pc-badge--plain pc-num'+(complete?' pc-badge--done':''),text:doneCnt+'/'+ms.length})),
      byeP&&h('p',{class:'app-note',style:{margin:'0 0 var(--space-2)'},text:'Pause: '+first(byeP.name)}),
      // Teams are listed until the schedule exists; after that the match cards show them.
      noSchedule&&h('div',{class:'pc-card',style:{marginBottom:'var(--space-3)'}},teams.map((t,i)=>h('div',{class:'app-row'},
        h('span',{class:'pc-badge pc-badge--plain pc-num',text:String(i+1)}),
        h('span',{class:'app-row__text'},h('span',{class:'title-3',text:teamLabel(t)}))))),
      noSchedule&&isCurrent&&canEdit&&h('div',{class:'app-stack'},
        teams.length>=2&&btn('primary','Spielplan erstellen',()=>genMatches(ev.id,rnd),{block:true}),
        h('div',{class:'app-actions'},
          btn('secondary','Neu mischen',()=>genTeams(ev.id,rnd),{icon:'shuffle'}),
          btn('secondary','Manuell',()=>openTeamBuilder(ev.id,rnd)))),
      h('div',{class:'app-list'},ms.map(m=>eventMatchCard(ev,m))),
      complete&&isCurrent&&canEdit&&h('div',{class:'pc-card app-pad',style:{marginTop:'var(--space-3)'}},
        h('div',{class:'title-3',text:'Runde '+rnd+' ist fertig'}),
        h('p',{class:'app-note',text:'Alle '+ms.length+' Matches haben ein Ergebnis.'}),
        h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
          btn('primary','Nächste Runde mischen',()=>genTeams(ev.id,rnd+1),{icon:'shuffle'}),
          btn('secondary','Manuell',()=>openTeamBuilder(ev.id,rnd+1)))));
  });

  return h('main',{class:'app-screen pc-enter'},
    eventHead(ev,overlineOf(ev,cr>0&&'Runde '+cr)),roster,start,roundBlocks,eventSection(ev));
};

export const renderDetail=()=>{
  const ev=getEv();if(!ev)return renderEvents();
  const format=formatOf(ev);
  return format==='americano'?renderAmericano(ev):format==='classic'?renderClassic(ev):renderPadelDay(ev);
};
