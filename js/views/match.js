// A match: the card, and the sheet that enters its score.
import {h,icon,btn,badge,first} from '../dom.js';
import {S,mut} from '../store.js';
import {calcWinner,checkScore} from '../logic.js';
import {deleteMatch} from '../actions.js';
import {openSheet,confirmSheet} from '../sheet.js';

const teamOf=id=>S.teams.find(t=>t.id===id);
const playerName=id=>first(S.players.find(p=>p.id===id)?.name);
// "Anna & Ben", always from the current player names.
export const teamLabel=team=>playerName(team.player1Id)+' & '+playerName(team.player2Id);
const setsOf=m=>[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].filter(([a,b])=>a!=null&&b!=null);
const teamRow=(side,label)=>h('span',{class:'pc-team pc-team--'+side},h('span',{class:'pc-team__names',text:label}));

// ─── MatchCard ────────────────────────────────────────────────
// One number per team: the games of a single set, or the sets won when
// more than one set was played (the sets themselves go in the top line).
export const matchCard=(match,onOpen)=>{
  const t1=teamOf(match.team1Id),t2=teamOf(match.team2Id);
  if(!t1||!t2)return null;
  const done=match.status==='completed',w=match.winnerTeamId;
  const played=done&&(w===t1.id||w===t2.id);
  const sets=setsOf(match);
  let a='–',b='–',detail='';
  if(played){
    if(sets.length===1)[a,b]=sets[0];
    else{
      a=sets.filter(([x,y])=>x>y).length;b=sets.filter(([x,y])=>y>x).length;
      detail=' · '+sets.map(([x,y])=>x+':'+y).join(' ');
    }
  }
  const status=played?badge('done','Beendet'):done?badge('','Nicht gespielt'):badge('','Geplant');
  const card=h('div',{class:'pc-card pc-match'+(played?'':' pc-match--planned')+(onOpen?'':' app-static')},
    h('div',{class:'pc-match__meta'},h('span',{class:'pc-num',text:'Runde '+match.rnd+' · Spiel '+match.seq+detail}),status),
    h('div',{class:'pc-match__teams'},teamRow('a',teamLabel(t1)),teamRow('b',teamLabel(t2))),
    h('div',{class:'pc-match__score'},
      h('span',{class:played&&w===t1.id?'is-win':null,text:String(a)}),
      h('span',{class:played&&w===t2.id?'is-win':null,text:String(b)})));
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

// ─── Score sheet ──────────────────────────────────────────────
const SET_LABELS=['Satz 1','Satz 2','Satz 3 (Super-Tiebreak)'];
// Sets one and two go to 7 at most; the super tie-break is open-ended.
const SET_MAX=[7,7,99];

export const openScoreSheet=match=>{
  const t1=teamOf(match.team1Id),t2=teamOf(match.team2Id);
  if(!t1||!t2)return;
  const sets=setsOf(match).map(([a,b])=>({t1:a,t2:b}));
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
    addBtn.hidden=sets.length>=3;
  };
  draw();

  const save=()=>{
    const chk=checkScore(sets);
    if(!chk.ok){error.textContent=chk.error;return;}
    if(chk.notPlayed)sets.splice(1);
    mut(()=>{
      const m=S.matches.find(x=>x.id===match.id);if(!m)return;
      m.t1s1=sets[0]?.t1??null;m.t2s1=sets[0]?.t2??null;
      m.t1s2=sets[1]?.t1??null;m.t2s2=sets[1]?.t2??null;
      m.t1s3=sets[2]?.t1??null;m.t2s3=sets[2]?.t2??null;
      m.status='completed';m.winnerTeamId=calcWinner(m);
    });
    sheet.close();
  };
  const remove=()=>{
    sheet.close();
    confirmSheet({
      title:'Match löschen?',
      text:teamLabel(t1)+' gegen '+teamLabel(t2)+' wird entfernt. Ein eingetragenes Ergebnis verschwindet aus der Rangliste.',
      action:'Match löschen',danger:true,
      onConfirm:()=>deleteMatch(match.id),
    });
  };

  const sheet=openSheet({
    title:'Ergebnis eintragen',
    body:[
      list,error,
      h('div',{class:'app-sheet-extra'},addBtn,
        h('p',{class:'app-note',text:'0 : 0 speichern heißt: Das Match hat nicht stattgefunden.'}),
        btn('danger','Match löschen',remove,{block:true})),
    ],
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),btn('primary','Ergebnis speichern',save)],
  });
  return sheet;
};
