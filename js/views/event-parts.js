// Pieces every kind of event screen shares: head, participants, the
// "Event" section, and the match card that fits the event's format.
import {h,icon,btn,badge,headline,section,first,initials,dm,weekday} from '../dom.js';
import {S,IS_PLAYER,IS_ADMIN,getEP,getMat,curRnd,matByRnd,notify} from '../store.js';
import {toggleParticipant,completeEvent,deleteEvent,moveEvent,exportTXT} from '../actions.js';
import {classicEditable,STAGE_LABEL} from '../tournament.js';
import {matchCard,openScoreSheet} from './match.js';
import {openSheet,confirmSheet} from '../sheet.js';

export const FORMAT_LABEL={padel_day:'Padel Day',americano:'Americano',classic:'Turnier'};
export const formatOf=ev=>ev.format||'padel_day';

export const statusBadge=ev=>ev.status==='active'?badge('live','Live')
  :ev.status==='completed'?badge('locked','Gesperrt','lock')
  :badge('','Geplant');

// The next match without a result: in a Padel Day within the current
// round, in a tournament in playing order.
export const nextOpenMatch=eid=>{
  const ev=S.events.find(e=>e.id===eid);
  if(!ev||formatOf(ev)==='padel_day')return matByRnd(eid,curRnd(eid)).find(m=>m.status!=='completed')||null;
  return getMat(eid).sort((a,b)=>a.rnd-b.rnd||a.seq-b.seq).find(m=>m.status!=='completed')||null;
};

// The card of a match, labelled and opened the way its event needs.
export const eventMatchCard=(ev,match)=>{
  const format=formatOf(ev);
  const open=IS_PLAYER&&ev.status!=='completed'&&(format!=='classic'||classicEditable(match,getMat(ev.id)));
  const groupOf=m=>S.teams.find(t=>t.id===m.team1Id)?.grp;
  const label=format==='americano'?'Runde '+match.rnd+' · Platz '+(match.court||match.seq)
    :format==='classic'?(match.stage==='group'?'Gruppe '+groupOf(match)+' · Spiel '+match.seq
      :match.stage==='place'?(match.seq===1?'Final':'Spiel um Platz '+(2*match.seq-1))
      :match.stage==='semi'||match.stage==='quarter'?STAGE_LABEL[match.stage]+' '+match.seq:STAGE_LABEL[match.stage])
    :null;
  return matchCard(match,open?()=>openScoreSheet(match):null,{label,points:format==='americano'});
};

// Back button, headline with the date, status, and the overall progress.
export const eventHead=(ev,overline)=>{
  const all=getMat(ev.id),done=all.filter(m=>m.status==='completed').length;
  return[
    h('button',{type:'button',class:'pc-btn pc-btn--ghost app-back',onclick:()=>{S.selEv=null;S.sub=null;if(!IS_PLAYER)S.tab='start';notify();}},
      icon('back'),IS_PLAYER?'Events':'Start'),
    h('div',{class:'app-head'},headline(overline,FORMAT_LABEL[formatOf(ev)]+' ',dm(ev.date)),statusBadge(ev)),
    all.length>0&&h('div',null,
      h('div',{class:'app-section__head'},
        h('span',{class:'pc-overline',text:'Fortschritt'}),
        h('span',{class:'caption pc-num pc-muted',text:done+'/'+all.length+' Matches'})),
      h('div',{class:'pc-progress',role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(Math.round(done/all.length*100))},
        h('i',{style:{width:(done/all.length*100)+'%'}}))),
  ];
};
export const overlineOf=(ev,extra)=>[weekday(ev.date),extra].filter(Boolean).join(', ');

// "Wer spielt heute?": chips for every active player. `locked` freezes it.
export const rosterSection=(ev,locked,note)=>{
  const ep=getEP(ev.id);
  return section('Wer spielt heute? ('+ep.length+')',null,
    h('div',{class:'pc-row'},S.players.filter(p=>p.isActive||ep.includes(p)).map(p=>
      h('button',{type:'button',class:'pc-chip','aria-pressed':String(ep.includes(p)),disabled:locked,
        onclick:()=>toggleParticipant(ev.id,p.id)},
        h('span',{class:'pc-chip__avatar',text:initials(p.name)}),first(p.name)))),
    note&&h('p',{class:'app-note',text:note}));
};

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
    body:[h('p',{class:'pc-muted',style:{margin:'0 0 var(--space-4)'},text:ev.name+' gehört danach zur gewählten Saison.'}),chips],
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),moveBtn],
  });
  return sheet;
};

// The "Event" section at the bottom: season, and what can be done with the
// event as a whole. `extra` are further buttons of the specific format.
export const eventSection=(ev,extra=[])=>{
  const locked=ev.status==='completed';
  const actions=[
    ev.status==='active'&&IS_PLAYER&&btn('secondary','Event abschließen',()=>confirmSheet({
      title:'Event abschließen?',
      text:ev.name+' wird gesperrt. Ergebnisse lassen sich danach nicht mehr ändern.',
      action:'Abschließen',onConfirm:()=>completeEvent(ev.id)}),{icon:'lock'}),
    locked&&btn('secondary','Als Text exportieren',()=>exportTXT(ev.id),{icon:'download'}),
    IS_ADMIN&&S.seasons.length>1&&btn('secondary','Saison ändern',()=>openMoveEvent(ev)),
    ...extra,
    IS_ADMIN&&btn('danger','Event löschen',()=>confirmSheet({
      title:'Event löschen?',
      text:ev.name+' wird mit allen Runden und Ergebnissen entfernt. Das lässt sich nicht rückgängig machen.',
      action:'Event löschen',danger:true,onConfirm:()=>deleteEvent(ev.id)})),
  ].filter(Boolean);
  return section('Event',null,
    h('p',{class:'app-note',style:{margin:'0 0 var(--space-3)'},text:'Saison: '+(S.seasons.find(s=>s.id===ev.sid)?.name||'unbekannt')
      +(formatOf(ev)==='padel_day'?'':' · zählt nicht für die Saison-Rangliste')}),
    actions.length>0&&h('div',{class:'app-actions'},actions));
};
