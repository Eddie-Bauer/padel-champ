// Events: the list of Padel Days, and the sheet that creates one.
import {h,btn,badge,headline,dayOfMonth,monthShort,today} from '../dom.js';
import {S,IS_PLAYER,activeSeason,getMat,getEP,curRnd,notify} from '../store.js';
import {addEvent} from '../actions.js';
import {seasonForDate} from '../logic.js';
import {openSheet} from '../sheet.js';

const statusBadge=ev=>ev.status==='active'?badge('live','Live')
  :ev.status==='completed'?badge('locked','Gesperrt','lock')
  :badge('','Geplant');

// A Padel Day as a tappable card. Used on Events and on Start.
export const eventCard=ev=>{
  const all=getMat(ev.id),done=all.filter(m=>m.status==='completed').length;
  const rnd=curRnd(ev.id),n=getEP(ev.id).length;
  const sub=[rnd>0&&'Runde '+rnd,n>0&&n+' Spieler',all.length>0&&done+'/'+all.length+' Matches'].filter(Boolean).join(' · ')||'Noch keine Spieler gewählt';
  return h('button',{type:'button',class:'pc-card pc-event',onclick:()=>{S.tab='events';S.selEv=ev.id;notify();}},
    h('div',{class:'pc-event__date pc-num'},h('b',{text:dayOfMonth(ev.date)}),h('small',{text:monthShort(ev.date)})),
    h('div',null,
      h('div',{class:'pc-event__title',text:ev.name}),
      h('div',{class:'pc-event__sub pc-num',text:sub}),
      ev.status==='active'&&all.length>0&&h('div',{class:'pc-progress',style:{marginTop:'var(--space-2)'},role:'progressbar','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(Math.round(done/all.length*100))},
        h('i',{style:{width:(done/all.length*100)+'%'}}))),
    statusBadge(ev));
};

export const openNewEvent=()=>{
  const input=h('input',{class:'pc-input pc-num',type:'date',value:today()});
  const hint=h('span',{class:'pc-field__hint'});
  const showSeason=()=>{const s=input.value&&seasonForDate(S.seasons,input.value);hint.textContent=s?'Kommt in die Saison '+s.name+'.':'';};
  input.addEventListener('input',showSeason);showSeason();
  const create=()=>{
    if(!input.value)return;
    const id=addEvent(input.value);
    sheet.close();
    if(id){S.tab='events';S.selEv=id;notify();}
  };
  input.addEventListener('keydown',e=>{if(e.key==='Enter')create();});
  const sheet=openSheet({
    title:'Neuer Padel Day',
    body:h('label',{class:'pc-field'},
      h('span',{class:'pc-field__label',text:'Datum'}),input,hint),
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
          h('p',{style:{margin:'0'},text:'Noch kein Padel Day in dieser Saison.'}),
          IS_PLAYER&&btn('primary','Neuer Padel Day',openNewEvent,{icon:'plus'}))
      :h('div',{class:'app-list'},evs.map(eventCard)));
};
