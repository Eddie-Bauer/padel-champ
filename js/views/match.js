// A match: the card, and the sheets that enter its result.
import {h,icon,btn,badge,first} from '../dom.js';
import {S,getEP} from '../store.js';
import {saveScore,saveAmericanoScore,resetScore,deleteMatch} from '../actions.js';
import {americanoConfig,classicConfig} from '../tournament.js';
import {openSheet,confirmSheet} from '../sheet.js';

const teamOf=id=>S.teams.find(t=>t.id===id);
const playerName=id=>first(S.players.find(p=>p.id===id)?.name);
// "Anna & Ben", always from the current player names.
export const teamLabel=team=>playerName(team.player1Id)+' & '+playerName(team.player2Id);
const setsOf=m=>[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].filter(([a,b])=>a!=null&&b!=null);
const teamRow=(side,label)=>h('span',{class:'pc-team pc-team--'+side},h('span',{class:'pc-team__names',text:label}));
// In a match card the two names of a team stand one below the other.
const teamStack=(side,team)=>h('span',{class:'pc-team pc-team--'+side},
  h('span',{class:'pc-team__names pc-team__names--stack'},h('span',{text:playerName(team.player1Id)}),h('span',{text:playerName(team.player2Id)})));

// ─── MatchCard ────────────────────────────────────────────────
// One number per team. Sets: the games of a single set, or the sets won
// when more than one was played (the sets themselves go in the top line).
// Points (Americano): the points of each team.
// opts.label replaces "Runde n · Spiel n"; opts.points switches to points.
export const matchCard=(match,onOpen,opts={})=>{
  const t1=teamOf(match.team1Id),t2=teamOf(match.team2Id);
  if(!t1||!t2)return null;
  const done=match.status==='completed',w=match.winnerTeamId;
  const played=opts.points?done:done&&(w===t1.id||w===t2.id);
  const sets=setsOf(match);
  let a='–',b='–',detail='';
  if(played){
    if(opts.points||sets.length===1)[a,b]=sets[0]||[0,0];
    else{
      a=sets.filter(([x,y])=>x>y).length;b=sets.filter(([x,y])=>y>x).length;
      detail=' · '+sets.map(([x,y])=>x+':'+y).join(' ');
    }
  }
  const status=played?badge('done','Beendet'):done?badge('','Nicht gespielt'):badge('','Geplant');
  const card=h('div',{class:'pc-card pc-match'+(played?'':' pc-match--planned')+(onOpen?'':' app-static')},
    h('div',{class:'pc-match__meta'},h('span',{class:'pc-num',text:(opts.label||'Runde '+match.rnd+' · Spiel '+match.seq)+detail}),status),
    teamStack('a',t1),
    h('div',{class:'pc-match__score'},
      h('span',{class:played&&w===t1.id?'is-win':null,text:String(a)}),
      h('span',{class:played&&w===t2.id?'is-win':null,text:String(b)})),
    teamStack('b',t2));
  if(onOpen){
    card.setAttribute('role','button');
    card.setAttribute('tabindex','0');
    card.setAttribute('aria-label','Ergebnis eintragen: '+teamLabel(t1)+' gegen '+teamLabel(t2));
    card.addEventListener('click',onOpen);
    card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onOpen();}});
  }
  return card;
};

// ─── ScoreStepper ─────────────────────────────────────────────
// Keeps its own value and updates in place, so focus stays on the button.
const stepper=({side,label,value,max,onValue})=>{
  const out=h('output',{class:'pc-stepper__value','aria-live':'polite',text:String(value)});
  const minus=h('button',{type:'button',class:'pc-stepper__btn','aria-label':'Team '+side.toUpperCase()+' minus eins'},icon('minus',''));
  const plus=h('button',{type:'button',class:'pc-stepper__btn pc-stepper__btn--plus','aria-label':'Team '+side.toUpperCase()+' plus eins'},icon('plus',''));
  const set=v=>{value=v;out.textContent=String(v);minus.disabled=v<=0;plus.disabled=v>=max;onValue(v);};
  minus.addEventListener('click',()=>{if(value>0)set(value-1);});
  plus.addEventListener('click',()=>{if(value<max)set(value+1);});
  minus.disabled=value<=0;plus.disabled=value>=max;
  return[
    h('div',{class:'pc-stepper__team'},teamRow(side,label)),
    h('div',{class:'pc-stepper'},minus,out,plus),
  ];
};

// What is offered below the result: delete the match (Padel Day), or take
// the result back (tournament, where the schedule is fixed).
const extraActions=(match,ev,t1,t2,close)=>{
  const tournament=ev&&ev.format!=='padel_day';
  if(!tournament)return btn('danger','Match löschen',()=>{
    close();
    confirmSheet({
      title:'Match löschen?',
      text:teamLabel(t1)+' gegen '+teamLabel(t2)+' wird entfernt. Ein eingetragenes Ergebnis verschwindet aus der Rangliste.',
      action:'Match löschen',danger:true,onConfirm:()=>deleteMatch(match.id)});
  },{block:true});
  return match.status==='completed'&&btn('danger','Ergebnis löschen',()=>{
    close();
    confirmSheet({
      title:'Ergebnis löschen?',
      text:'Das Ergebnis von '+teamLabel(t1)+' gegen '+teamLabel(t2)+' wird entfernt. Das Match ist danach wieder offen.',
      action:'Ergebnis löschen',danger:true,onConfirm:()=>resetScore(match.id)});
  },{block:true});
};

// ─── Result in sets (Padel Day, classic tournament) ───────────
const SET_LABELS=['Satz 1','Satz 2','Satz 3 (Super-Tiebreak)'];
// Sets one and two go to 7 at most; the super tie-break is open-ended.
const SET_MAX=[7,7,99];

const openSetsSheet=(match,ev,t1,t2)=>{
  const classic=ev&&ev.format==='classic';
  const maxSets=classic&&(classicConfig(ev.config,S.teams.filter(t=>t.eid===ev.id).length)||{}).sets==='one'?1:3;
  const sets=setsOf(match).map(([a,b])=>({t1:a,t2:b})).slice(0,maxSets);
  if(!sets.length)sets.push({t1:0,t2:0});

  const list=h('div'),error=h('p',{class:'app-error',role:'alert'});
  const addBtn=btn('secondary','Satz hinzufügen',()=>{sets.push({t1:0,t2:0});draw();},{icon:'plus',block:true});
  const draw=()=>{
    error.textContent='';
    list.replaceChildren(...sets.map((s,i)=>h('div',{class:'app-set'},
      h('div',{class:'app-set__head'},
        h('span',{class:'pc-overline',text:SET_LABELS[i]}),
        i>0&&i===sets.length-1&&btn('ghost','Entfernen',()=>{sets.pop();draw();})),
      stepper({side:'a',label:teamLabel(t1),value:s.t1,max:SET_MAX[i],onValue:v=>{s.t1=v;error.textContent='';}}),
      stepper({side:'b',label:teamLabel(t2),value:s.t2,max:SET_MAX[i],onValue:v=>{s.t2=v;error.textContent='';}}))));
    addBtn.hidden=sets.length>=maxSets;
  };
  draw();

  const save=()=>{
    const r=saveScore(match.id,sets);
    if(!r.ok){error.textContent=r.error;return;}
    sheet.close();
  };
  const sheet=openSheet({
    title:'Ergebnis eintragen',
    body:[
      list,error,
      h('div',{class:'app-sheet-extra'},addBtn,
        h('p',{class:'app-note',text:classic?'Im Turnier braucht jedes Match einen Sieger.':'0 : 0 speichern heißt: Das Match hat nicht stattgefunden.'}),
        extraActions(match,ev,t1,t2,()=>sheet.close())),
    ],
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),btn('primary','Ergebnis speichern',save)],
  });
  return sheet;
};

// ─── Result in points (Americano) ─────────────────────────────
// Two numbers that add up to the points per match: typing one fills the other.
const openPointsSheet=(match,ev,t1,t2)=>{
  const total=americanoConfig(ev.config,getEP(ev.id).length).points;
  const done=match.status==='completed';
  const field=(side,label,value)=>{
    const input=h('input',{class:'pc-input pc-num',type:'text',inputmode:'numeric',autocomplete:'off',maxlength:'2',value:value==null?'':String(value),placeholder:'0 bis '+total});
    return{input,el:h('label',{class:'pc-field'},h('span',{class:'pc-field__label'},teamRow(side,label)),input)};
  };
  const a=field('a',teamLabel(t1),done?match.t1s1:null),b=field('b',teamLabel(t2),done?match.t2s1:null);
  const error=h('p',{class:'app-error',role:'alert'});
  const num=input=>/^\d+$/.test(input.value.trim())?Number(input.value.trim()):NaN;
  const mirror=(from,to)=>from.addEventListener('input',()=>{
    error.textContent='';
    const v=num(from);
    if(Number.isInteger(v)&&v>=0&&v<=total)to.value=String(total-v);
  });
  mirror(a.input,b.input);mirror(b.input,a.input);

  const save=()=>{
    const r=saveAmericanoScore(match.id,num(a.input),num(b.input));
    if(!r.ok){error.textContent=r.error;return;}
    sheet.close();
  };
  [a.input,b.input].forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')save();}));
  const sheet=openSheet({
    title:'Ergebnis eintragen',
    body:[
      h('div',{class:'app-stack'},a.el,b.el),error,
      h('div',{class:'app-sheet-extra'},
        h('p',{class:'app-note pc-num',text:'Gespielt wird auf '+total+' Punkte: Beide Zahlen zusammen ergeben '+total+'.'}),
        extraActions(match,ev,t1,t2,()=>sheet.close())),
    ],
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),btn('primary','Ergebnis speichern',save)],
  });
  return sheet;
};

export const openScoreSheet=match=>{
  const t1=teamOf(match.team1Id),t2=teamOf(match.team2Id);
  if(!t1||!t2)return;
  const ev=S.events.find(e=>e.id===match.eid);
  return ev&&ev.format==='americano'?openPointsSheet(match,ev,t1,t2):openSetsSheet(match,ev,t1,t2);
};
