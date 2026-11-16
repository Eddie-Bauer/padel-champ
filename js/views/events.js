// Events: the list of Padel Days, and the sheet that creates one.
import {h,btn,headline,dayOfMonth,monthShort,today} from '../dom.js';
import {S,IS_PLAYER,activeSeason,getMat,getEP,curRnd,notify} from '../store.js';
import {addEvent} from '../actions.js';
import {seasonForDate} from '../logic.js';
import {openSheet} from '../sheet.js';
import {statusBadge,formatOf} from './event-parts.js';
import {segmented,labelled} from './controls.js';

// A Padel Day as a tappable card. Used on Events and on Start.
export const eventCard=ev=>{
  const all=getMat(ev.id),done=all.filter(m=>m.status==='completed').length;
  const rnd=curRnd(ev.id),n=getEP(ev.id).length;
  const sub=[formatOf(ev)==='padel_day'&&rnd>0&&'Runde '+rnd,n>0&&n+' Spieler',all.length>0&&done+'/'+all.length+' Matches'].filter(Boolean).join(' · ')||'Noch keine Spieler gewählt';
  return h('button',{type:'button',class:'pc-card pc-event',onclick:()=>{S.tab='events';S.selEv=ev.id;S.sub=null;notify();}},
    h('div',{class:'pc-event__date pc-num'},h('b',{text:dayOfMonth(ev.date)}),h('small',{text:monthShort(ev.date)})),
    h('div',null,
      h('div',{class:'pc-event__title',text:ev.name}),
      h('div',{class:'pc-event__sub pc-num',text:sub}),
      ev.status==='active'&&all.length>0&&h('div',{class:'pc-progress',style:{marginTop:'var(--space-2)'},role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(Math.round(done/all.length*100))},
        h('i',{style:{width:(done/all.length*100)+'%'}}))),
    statusBadge(ev));
};

const FORMATS=[['padel_day','Padel Day'],['americano','Americano'],['classic','Turnier']];
const FORMAT_HINT={
  padel_day:'Jede Runde neue Teams, jeder gegen jeden. Zählt für die Saison-Rangliste.',
  americano:'Jeder spielt für sich, Partner und Gegner wechseln jede Runde. Eigene Rangliste nach Punkten.',
  classic:'Feste Paare, Gruppenphase, dann Playoff. Eigene Schlussrangliste.',
};

export const openNewEvent=()=>{
  let format='padel_day';
  const formatBox=h('div');
  const drawFormat=()=>formatBox.replaceChildren(
    labelled('Format',segmented('Format',FORMATS,format,v=>{format=v;drawFormat();})),
    h('p',{class:'app-note',text:FORMAT_HINT[format]}));
  drawFormat();
  const input=h('input',{class:'pc-input pc-num',type:'date',value:today()});
  const hint=h('span',{class:'pc-field__hint'});
  const showSeason=()=>{const s=input.value&&seasonForDate(S.seasons,input.value);hint.textContent=s?'Kommt in die Saison '+s.name+'.':'';};
  input.addEventListener('input',showSeason);showSeason();
  const create=()=>{
    if(!input.value)return;
    const id=addEvent(input.value,format);
    sheet.close();
    if(id){S.tab='events';S.selEv=id;notify();}
  };
  input.addEventListener('keydown',e=>{if(e.key==='Enter')create();});
  const sheet=openSheet({
    title:'Neues Event',
    body:h('div',{class:'app-stack'},formatBox,h('label',{class:'pc-field'},
      h('span',{class:'pc-field__label',text:'Datum'}),input,hint)),
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),btn('primary','Anlegen',create)],
  });
  return sheet;
};

export const renderEvents=()=>{
  const as=activeSeason();
  const evs=S.events.filter(e=>e.sid===as.id).sort((a,b)=>b.date.localeCompare(a.date));
  return h('main',{class:'app-screen pc-enter'},
    h('div',{class:'app-head'},headline(as.name,'Alle ','Events')),
    evs.length===0
      ?h('div',{class:'app-empty'},
          h('p',{style:{margin:'0'},text:'Noch kein Event in dieser Saison.'}),
          IS_PLAYER&&btn('primary','Neues Event',openNewEvent,{icon:'plus'}))
      :h('div',{class:'app-list'},evs.map(eventCard)));
};
