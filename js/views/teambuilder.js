// Sheet for building the teams of a round by hand.
import {h,btn,iconBtn,first,initials} from '../dom.js';
import {S,getEP} from '../store.js';
import {drawTeams} from '../logic.js';
import {applyManualTeams} from '../actions.js';
import {openSheet} from '../sheet.js';

export const openTeamBuilder=(eid,rnd)=>{
  const ep=getEP(eid);
  const isOdd=ep.length%2!==0;
  const prevByeId=(S.byeMap[eid]||{})[rnd-1]||null;
  let unassigned=[...ep],formed=[],sel=null,bye=null;

  const body=h('div',{class:'app-stack'});
  const confirmBtn=btn('primary','Teams bestätigen',()=>{applyManualTeams(eid,rnd,formed,bye);sheet.close();});
  const chip=(p,pressed,onclick)=>h('button',{type:'button',class:'pc-chip','aria-pressed':String(pressed),onclick},
    h('span',{class:'pc-chip__avatar',text:initials(p.name)}),first(p.name));

  const draw=()=>{
    const pickBye=isOdd&&unassigned.length===1;
    const hint=pickBye?'Wer hat Pause?':sel?'Zweiten Spieler wählen':'Zwei Spieler antippen für ein Team';
    body.replaceChildren(...[
      unassigned.length>0&&h('div',null,
        h('div',{class:'pc-overline',style:{marginBottom:'var(--space-2)'},text:hint}),
        h('div',{class:'pc-row'},unassigned.map(p=>chip(p,sel===p,()=>{
          if(pickBye){unassigned=[];bye=p;sel=null;}
          else if(sel===p)sel=null;
          else if(!sel)sel=p;
          else{formed.push({p1:sel,p2:p});unassigned=unassigned.filter(x=>x!==sel&&x!==p);sel=null;}
          draw();
        })))),
      bye&&h('div',{class:'pc-card app-row'},
        h('span',{class:'app-row__text'},h('span',{class:'title-3',text:first(bye.name)+' hat Pause'})),
        iconBtn('ghost','close','Pause aufheben',()=>{unassigned.push(bye);bye=null;draw();})),
      formed.length>0&&h('div',null,
        h('div',{class:'pc-overline',style:{marginBottom:'var(--space-2)'},text:'Teams ('+formed.length+')'}),
        h('div',{class:'pc-card'},formed.map((t,i)=>h('div',{class:'app-row'},
          h('span',{class:'pc-badge pc-badge--plain pc-num',text:String(i+1)}),
          h('span',{class:'app-row__text'},h('span',{class:'title-3',text:first(t.p1.name)+' & '+first(t.p2.name)})),
          iconBtn('ghost','close','Team auflösen',()=>{unassigned.push(t.p1,t.p2);formed.splice(i,1);draw();}))))),
      btn('secondary','Alle mischen',()=>{
        const d=drawTeams(ep,prevByeId);
        formed=d.pairs;unassigned=[];bye=d.bye;sel=null;draw();
      },{icon:'shuffle',block:true}),
    ].filter(Boolean));
    confirmBtn.disabled=!(formed.length>0&&unassigned.length===0&&(!isOdd||bye!==null));
  };
  draw();

  const sheet=openSheet({
    title:'Teams · Runde '+rnd,
    body,
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),confirmBtn],
  });
  return sheet;
};
