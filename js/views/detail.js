// One Padel Day: participants, rounds, teams and matches.
import {h,icon,btn,badge,headline,section,first,initials,dm,weekday} from '../dom.js';
import {S,IS_PLAYER,IS_ADMIN,getEP,getTeams,getMat,curRnd,matByRnd,teamByRnd,rndDone,getEv,notify} from '../store.js';
import {genTeams,genMatches,toggleParticipant,completeEvent,deleteEvent,moveEvent,exportTXT} from '../actions.js';
import {matchCard,openScoreSheet,teamLabel} from './match.js';
import {openTeamBuilder} from './teambuilder.js';
import {renderEvents} from './events.js';
import {openSheet,confirmSheet} from '../sheet.js';

// The next match without a result in the current round, if any.
export const nextOpenMatch=eid=>matByRnd(eid,curRnd(eid)).find(m=>m.status!=='completed')||null;

const statusBadge=ev=>ev.status==='active'?badge('live','Live')
  :ev.status==='completed'?badge('locked','Gesperrt','lock')
  :badge('','Geplant');

// Sheet that puts an event into another season.
export const openMoveEvent=ev=>{
  let target=ev.sid;
  const chips=h('div',{class:'pc-row',role:'group','aria-label':'Saison'});
  const moveBtn=btn('primary','Verschieben',()=>{moveEvent(ev.id,target);sheet.close();},{disabled:true});
  const draw=()=>{
    chips.replaceChildren(...S.seasons.map(ss=>h('button',{type:'button',class:'pc-chip app-chip-text','aria-pressed':String(ss.id===target),
      onclick:()=>{target=ss.id;draw();},text:ss.name})));
    moveBtn.disabled=target===ev.sid;
  };
  draw();
  const sheet=openSheet({
    title:'In welche Saison?',
    body:[h('p',{class:'pc-muted',style:{margin:'0 0 var(--space-4)'},text:ev.name+' zählt danach mit allen Ergebnissen für die gewählte Saison.'}),chips],
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),moveBtn],
  });
  return sheet;
};

export const renderDetail=()=>{
  const ev=getEv();if(!ev)return renderEvents();
  const ep=getEP(ev.id),cr=curRnd(ev.id);
  const rounds=[...new Set(getTeams(ev.id).map(t=>t.rnd))].sort((a,b)=>a-b);
  const all=getMat(ev.id),done=all.filter(m=>m.status==='completed').length;
  const locked=ev.status==='completed';
  const canEdit=IS_PLAYER&&!locked;

  // ── Head ──
  const head=[
    h('button',{type:'button',class:'pc-btn pc-btn--ghost app-back',onclick:()=>{S.selEv=null;if(!IS_PLAYER)S.tab='start';notify();}},
      icon('back'),IS_PLAYER?'Events':'Start'),
    h('div',{class:'app-head'},
      headline(weekday(ev.date)+(cr>0?', Runde '+cr:''),'Padel Day ',dm(ev.date)),
      statusBadge(ev)),
    all.length>0&&h('div',null,
      h('div',{class:'app-section__head'},
        h('span',{class:'pc-overline',text:'Fortschritt'}),
        h('span',{class:'caption pc-num pc-muted',text:done+'/'+all.length+' Matches · '+rounds.length+(rounds.length===1?' Runde':' Runden')})),
      h('div',{class:'pc-progress',role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(Math.round(done/all.length*100))},
        h('i',{style:{width:(done/all.length*100)+'%'}}))),
  ];

  // ── Participants ──
  const lockedRoster=cr>0||!canEdit;
  const roster=section('Wer spielt heute? ('+ep.length+')',null,
    h('div',{class:'pc-row'},S.players.filter(p=>p.isActive||ep.includes(p)).map(p=>{
      const on=ep.includes(p);
      return h('button',{type:'button',class:'pc-chip','aria-pressed':String(on),disabled:lockedRoster,
        onclick:()=>toggleParticipant(ev.id,p.id)},
        h('span',{class:'pc-chip__avatar',text:initials(p.name)}),first(p.name));
    })),
    cr>0?h('p',{class:'app-note',text:'Die Teilnehmer stehen seit Runde 1 fest.'})
      :ep.length<2&&h('p',{class:'app-note',text:'Mindestens 2 Spieler wählen.'}));

  // ── Start of round 1 ──
  const start=cr===0&&ep.length>=2&&canEdit&&h('div',{class:'pc-card app-pad app-section'},
    h('div',{class:'title-3',text:'Bereit zum Starten'}),
    h('p',{class:'app-note pc-num',text:ep.length+' Spieler'+(ep.length%2!==0?' · einer hat pro Runde Pause':'')}),
    h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
      btn('primary','Teams mischen',()=>genTeams(ev.id,1),{icon:'shuffle'}),
      btn('secondary','Manuell',()=>openTeamBuilder(ev.id,1))));

  // ── Rounds ──
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
      h('div',{class:'app-list'},ms.map(m=>matchCard(m,canEdit?()=>openScoreSheet(m):null))),
      complete&&isCurrent&&canEdit&&h('div',{class:'pc-card app-pad',style:{marginTop:'var(--space-3)'}},
        h('div',{class:'title-3',text:'Runde '+rnd+' ist fertig'}),
        h('p',{class:'app-note',text:'Alle '+ms.length+' Matches haben ein Ergebnis.'}),
        h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
          btn('primary','Nächste Runde mischen',()=>genTeams(ev.id,rnd+1),{icon:'shuffle'}),
          btn('secondary','Manuell',()=>openTeamBuilder(ev.id,rnd+1)))));
  });

  // ── Event actions ──
  const actions=[
    ev.status==='active'&&IS_PLAYER&&btn('secondary','Event abschließen',()=>confirmSheet({
      title:'Event abschließen?',
      text:ev.name+' wird gesperrt. Ergebnisse lassen sich danach nicht mehr ändern.',
      action:'Abschließen',onConfirm:()=>completeEvent(ev.id)}),{icon:'lock'}),
    locked&&btn('secondary','Als Text exportieren',()=>exportTXT(ev.id),{icon:'download'}),
    IS_ADMIN&&S.seasons.length>1&&btn('secondary','Saison ändern',()=>openMoveEvent(ev)),
    IS_ADMIN&&btn('danger','Event löschen',()=>confirmSheet({
      title:'Event löschen?',
      text:ev.name+' wird mit allen Runden und Ergebnissen entfernt. Die Ergebnisse verschwinden aus der Rangliste. Das lässt sich nicht rückgängig machen.',
      action:'Event löschen',danger:true,onConfirm:()=>deleteEvent(ev.id)})),
  ].filter(Boolean);

  return h('main',{class:'app-screen pc-enter'},head,roster,start,roundBlocks,
    section('Event',null,
      h('p',{class:'app-note',style:{margin:'0 0 var(--space-3)'},text:'Saison: '+(S.seasons.find(s=>s.id===ev.sid)?.name||'unbekannt')}),
      actions.length>0&&h('div',{class:'app-actions'},actions)));
};
