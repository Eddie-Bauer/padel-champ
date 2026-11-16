// Americano: setup, round plan and ranking.
import {h,btn,first} from '../dom.js';
import {S,IS_PLAYER,getEP,getTeams,getMat,notify} from '../store.js';
import {setEventConfig,startAmericano,resetTournament} from '../actions.js';
import {americanoConfig,americanoRounds,americanoStandings,americanoResults,restingIn,AMERICANO_POINTS} from '../tournament.js';
import {eventHead,overlineOf,rosterSection,eventSection,eventMatchCard} from './event-parts.js';
import {valueStepper,segmented,labelled} from './controls.js';
import {confirmSheet} from '../sheet.js';

// ── Before the start: who plays, on how many courts, to how many points ──
const setup=(ev,ep,canEdit)=>{
  const n=ep.length;
  if(n<4)return[rosterSection(ev,!canEdit,'Americano braucht mindestens 4 Spieler.')];
  const cfg=americanoConfig(ev.config,n),maxCourts=Math.floor(n/4);
  const playing=cfg.courts*4,resting=n-playing;
  const full=americanoRounds(n,cfg.courts);
  return[
    rosterSection(ev,!canEdit,null),
    canEdit&&h('section',{class:'app-section'},
      h('div',{class:'app-section__head'},h('h2',{class:'pc-overline',text:'Einstellungen'})),
      h('div',{class:'pc-card app-pad app-stack'},
        valueStepper('Plätze',cfg.courts,1,maxCourts,v=>setEventConfig(ev.id,{courts:v,rounds:null}),
          'Pro Runde spielen '+playing+' Spieler'+(resting>0?', '+resting+(resting===1?' hat':' haben')+' Pause.':'.')),
        labelled('Punkte pro Match',segmented('Punkte pro Match',AMERICANO_POINTS.map(p=>[p,String(p)]),cfg.points,v=>setEventConfig(ev.id,{points:v}))),
        valueStepper('Runden',cfg.rounds,1,60,v=>setEventConfig(ev.id,{rounds:v}),
          'Nach '+full+' Runden hat jeder einmal mit jedem gespielt.'))),
    canEdit&&h('div',{class:'app-section'},
      btn('primary','Spielplan erstellen',()=>startAmericano(ev.id),{block:true}),
      h('p',{class:'app-note',text:'Alle Runden werden im Voraus ausgelost. Die Teilnehmer stehen danach fest.'})),
  ];
};

// ── Round plan ──
const plan=(ev,ep,teams,ms)=>{
  const rounds=[...new Set(ms.map(m=>m.rnd))].sort((a,b)=>a-b);
  const ids=ep.map(p=>p.id);
  return rounds.map(rnd=>{
    const rm=ms.filter(m=>m.rnd===rnd).sort((a,b)=>a.seq-b.seq);
    const doneCnt=rm.filter(m=>m.status==='completed').length;
    const rest=restingIn(ids,teams,rnd).map(id=>first(ep.find(p=>p.id===id).name));
    return h('section',{class:'app-section'},
      h('div',{class:'app-section__head'},
        h('h2',{class:'title-2',text:'Runde '+rnd}),
        h('span',{class:'pc-badge pc-badge--plain pc-num'+(doneCnt===rm.length?' pc-badge--done':''),text:doneCnt+'/'+rm.length})),
      rest.length>0&&h('p',{class:'app-note',style:{margin:'0 0 var(--space-2)'},text:'Pause: '+rest.join(', ')}),
      h('div',{class:'app-list'},rm.map(m=>eventMatchCard(ev,m))));
  });
};

// ── Ranking ──
const COLS=[['#','Rang','c-rank'],['Spieler','Spieler','c-name'],['Sp','Spiele','c-opt'],['S','Siege',''],['Diff','Punktedifferenz',''],['Pkt','Punkte','c-pts']];
const table=(ep,teams,ms)=>{
  const rows=americanoStandings(ep.map(p=>p.id),americanoResults(teams,ms));
  const name=id=>ep.find(p=>p.id===id).name;
  const adjusted=rows.some(r=>r.adjPts!==r.pts);
  const sign=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
  return h('section',{class:'app-section'},
    h('div',{class:'pc-card',style:{overflow:'hidden'}},
      h('table',{class:'pc-standings'},
        h('thead',null,h('tr',null,COLS.map(([abbr,word,cls])=>
          h('th',{class:cls||null,title:word,scope:'col',style:cls==='c-name'?{textAlign:'left'}:null,text:abbr})))),
        h('tbody',null,rows.map((r,i)=>h('tr',{class:i===0&&r.played>0?'is-leader':null},
          h('td',{class:'c-rank'},h('b',{text:String(r.rank)})),
          h('td',{class:'c-name',text:name(r.id)}),
          h('td',{class:'c-opt',text:String(r.played)}),
          h('td',{text:String(r.wins)}),
          h('td',{class:r.diff>0?'is-pos':r.diff<0?'is-neg':null,text:sign(r.diff)}),
          h('td',{class:'c-pts',text:String(r.adjPts)})))))),
    h('p',{class:'app-note',text:'Pkt = Summe der eigenen Punkte.'+(adjusted?' Wer öfter Pause hatte, bekommt für jedes fehlende Spiel seinen eigenen Durchschnitt.':'')}));
};

export const renderAmericano=ev=>{
  const ep=getEP(ev.id),teams=getTeams(ev.id),ms=getMat(ev.id);
  const canEdit=IS_PLAYER&&ev.status!=='completed';
  const started=ms.length>0;
  const sub=S.sub==='table'?'table':'plan';
  const discard=canEdit&&started&&btn('danger','Spielplan verwerfen',()=>confirmSheet({
    title:'Spielplan verwerfen?',
    text:'Alle Runden und Ergebnisse von '+ev.name+' werden gelöscht. Danach kannst du Teilnehmer und Einstellungen ändern und neu auslosen.',
    action:'Verwerfen',danger:true,onConfirm:()=>resetTournament(ev.id)}));

  return h('main',{class:'app-screen pc-enter'},
    eventHead(ev,overlineOf(ev,started&&ep.length+' Spieler')),
    !started?setup(ev,ep,canEdit):[
      segmented('Ansicht',[['plan','Spielplan'],['table','Rangliste']],sub,v=>{S.sub=v;notify();}),
      sub==='table'?table(ep,teams,ms):plan(ev,ep,teams,ms),
    ],
    eventSection(ev,[discard]));
};
