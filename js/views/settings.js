// Einstellungen: theme for everyone; points, seasons and resets for admin.
import {h,btn,icon,headline,section,badge,dmy} from '../dom.js';
import {S,IS_ADMIN,IS_PLAYER,notify} from '../store.js';
import {getTheme,setTheme} from '../theme.js';
import {setPoints,addSeason,activateSeason,clearGameData,clearEverything} from '../actions.js';
import {openSheet,confirmSheet} from '../sheet.js';

const themeSwitch=()=>{
  const cur=getTheme();
  const opt=(key,label)=>h('button',{type:'button',role:'tab','aria-selected':String(cur===key),onclick:()=>{if(cur!==key)setTheme(key);},text:label});
  return h('div',{class:'pc-seg',role:'tablist','aria-label':'Design'},opt('light','Hell'),opt('dark','Dunkel'));
};

// A stepper for a small setting value; saves on every tap.
const pointsStepper=(label,key,min,max)=>{
  const value=S.settings[key]||0;
  const step=(d,word,cls,ic,off)=>h('button',{type:'button',class:'pc-stepper__btn'+cls,'aria-label':label+' '+word,disabled:off,
    onclick:()=>setPoints(key,value+d)},icon(ic,''));
  return h('div',null,
    h('div',{class:'pc-stepper__team',text:label}),
    h('div',{class:'pc-stepper'},
      step(-1,'minus eins','','minus',value<=min),
      h('output',{class:'pc-stepper__value','aria-live':'polite',text:String(value)}),
      step(1,'plus eins',' pc-stepper__btn--plus','plus',value>=max)));
};

const openNewSeason=()=>{
  const name=h('input',{class:'pc-input',type:'text',placeholder:'z. B. Sommer 2027',autocomplete:'off',maxlength:'40'});
  const start=h('input',{class:'pc-input pc-num',type:'date'}),end=h('input',{class:'pc-input pc-num',type:'date'});
  const error=h('p',{class:'app-error',role:'alert'});
  const field=(label,input)=>h('label',{class:'pc-field'},h('span',{class:'pc-field__label',text:label}),input);
  const create=()=>{
    if(!name.value.trim()||!start.value||!end.value){error.textContent='Bitte Name, Start und Ende ausfüllen.';return;}
    if(end.value<start.value){error.textContent='Das Ende muss nach dem Start liegen.';return;}
    addSeason(name.value.trim(),start.value,end.value);sheet.close();
  };
  const sheet=openSheet({
    title:'Neue Saison',
    body:h('div',{class:'app-stack'},field('Name',name),field('Start',start),field('Ende',end),error),
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),btn('primary','Anlegen',create)],
  });
};

const seasonRow=ss=>{
  const evCount=S.events.filter(e=>e.sid===ss.id).length;
  const meta=[ss.startDate&&dmy(ss.startDate)+' bis '+dmy(ss.endDate),evCount>0&&evCount+(evCount===1?' Event':' Events')].filter(Boolean).join(' · ');
  return h('div',{class:'app-row'},
    h('span',{class:'app-row__text'},h('span',{class:'title-3',text:ss.name}),h('span',{class:'body-sm pc-muted pc-num',text:meta})),
    ss.isActive?badge('done','Aktiv'):btn('secondary','Aktivieren',()=>activateSeason(ss.id)));
};

export const renderSettings=()=>h('main',{class:'app-screen pc-enter'},
  h('button',{type:'button',class:'pc-btn pc-btn--ghost app-back',onclick:()=>{S.tab='start';notify();}},icon('back'),'Start'),
  h('div',{class:'app-head'},headline(IS_ADMIN?'Admin':IS_PLAYER?'Spieler':'Zuschauer',null,'Einstellungen')),

  section('Design',null,themeSwitch()),

  IS_ADMIN&&section('Punktesystem',null,
    h('div',{class:'pc-card app-pad app-stack'},
      pointsStepper('Punkte pro Sieg','ptsWin',1,10),
      pointsStepper('Punkte pro Niederlage','ptsLoss',0,9))),

  IS_ADMIN&&section('Saisons',null,
    h('div',{class:'pc-card'},S.seasons.map(seasonRow)),
    h('div',{class:'app-actions',style:{marginTop:'var(--space-3)'}},btn('secondary','Neue Saison',openNewSeason,{icon:'plus'}))),

  IS_ADMIN&&section('Daten zurücksetzen',null,
    h('div',{class:'app-stack'},
      btn('danger','Spieldaten löschen',()=>confirmSheet({
        title:'Spieldaten löschen?',
        text:'Alle Events, Teams und Ergebnisse aller Saisons werden gelöscht. Spieler und Saisons bleiben erhalten. Das lässt sich nicht rückgängig machen.',
        action:'Spieldaten löschen',danger:true,onConfirm:clearGameData}),{block:true}),
      btn('danger','Alles löschen',()=>confirmSheet({
        title:'Alles löschen?',
        text:'Alle Events, Ergebnisse und Spieler werden gelöscht und das Punktesystem zurückgesetzt. Nur die Saisons bleiben. Das lässt sich nicht rückgängig machen.',
        action:'Alles löschen',danger:true,onConfirm:clearEverything}),{block:true}))));
