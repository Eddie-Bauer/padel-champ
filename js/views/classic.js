// Classic tournament: fixed pairs, groups, then a playoff.
import {h,btn} from '../dom.js';
import {S,IS_PLAYER,getEP,getTeams,getMat,notify} from '../store.js';
import {setEventConfig,drawClassicTeams,startClassic,drawTiebreak,resetTournament} from '../actions.js';
import {classicOptions,classicConfig,classicNext,groupsOf,tableOf,finalPlacing,placementPlacing,STAGE_LABEL} from '../tournament.js';
import {teamLabel} from './match.js';
import {openTeamBuilder} from './teambuilder.js';
import {eventHead,overlineOf,rosterSection,eventSection,eventMatchCard} from './event-parts.js';
import {segmented,labelled} from './controls.js';
import {confirmSheet} from '../sheet.js';

const PLAYOFF_WORD={2:'Final',4:'Halbfinal',8:'Viertelfinal'};
const optionLabel=o=>o.mode==='placement'?'2 Gruppen · Platzierungsspiele'
  :o.groups+(o.groups===1?' Gruppe':' Gruppen')+' · '+o.advance+' weiter · ab '+PLAYOFF_WORD[o.playoffSize];
const teamList=teams=>h('div',{class:'pc-card'},teams.map((t,i)=>h('div',{class:'app-row'},
  h('span',{class:'pc-badge pc-badge--plain pc-num',text:t.grp||String(i+1)}),
  h('span',{class:'app-row__text'},h('span',{class:'title-3',text:teamLabel(t)})))));

// ── Step 1: who plays, and in which pairs ──
const pickTeams=(ev,ep,canEdit)=>{
  const n=ep.length,ok=n>=4&&n%2===0;
  return[
    rosterSection(ev,!canEdit,n<4?'Ein Turnier braucht mindestens 4 Spieler.':n%2!==0?'Für feste Paare braucht es eine gerade Zahl von Spielern.':null),
    canEdit&&ok&&h('div',{class:'pc-card app-pad app-section'},
      h('div',{class:'title-3',text:n/2+' Teams bilden'}),
      h('p',{class:'app-note',text:'Die Paare bleiben das ganze Turnier zusammen.'}),
      h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
        btn('primary','Teams auslosen',()=>drawClassicTeams(ev.id),{icon:'shuffle'}),
        btn('secondary','Manuell',()=>openTeamBuilder(ev.id,0,'Teams bilden')))),
  ];
};

// ── Step 2: groups, playoff size, match length ──
const pickSetup=(ev,teams,canEdit)=>{
  const cfg=classicConfig(ev.config,teams.length);
  const options=classicOptions(teams.length);
  return[
    h('section',{class:'app-section'},
      h('div',{class:'app-section__head'},h('h2',{class:'pc-overline',text:'Teams ('+teams.length+')'})),
      teamList(teams)),
    canEdit&&cfg&&h('section',{class:'app-section'},
      h('div',{class:'app-section__head'},h('h2',{class:'pc-overline',text:'Modus'})),
      h('div',{class:'pc-card app-pad app-stack'},
        labelled('Gruppen und Playoff',h('div',{class:'pc-row',role:'group','aria-label':'Gruppen und Playoff'},
          options.map(o=>h('button',{type:'button',class:'pc-chip app-chip-text','aria-pressed':String(o.mode===cfg.mode&&o.groups===cfg.groups&&o.advance===cfg.advance),
            onclick:()=>setEventConfig(ev.id,{groups:o.groups,advance:o.advance,mode:o.mode}),text:optionLabel(o)})))),
        labelled('Matchlänge',segmented('Matchlänge',[['bo3','2 Gewinnsätze'],['one','1 Satz']],cfg.sets,v=>setEventConfig(ev.id,{sets:v}))),
        cfg.playoffSize>=4&&labelled('Spiel um Platz 3',segmented('Spiel um Platz 3',[[true,'Ja'],[false,'Nein']],cfg.thirdPlace,v=>setEventConfig(ev.id,{thirdPlace:v}))))),
    canEdit&&cfg&&h('div',{class:'app-section'},
      btn('primary','Gruppen auslosen und starten',()=>startClassic(ev.id),{block:true}),
      h('p',{class:'app-note',text:cfg.mode==='placement'
        ?'In der Gruppe spielt jeder gegen jeden. Danach spielt jeder Gruppenrang gegen denselben Rang der anderen Gruppe: die beiden Ersten um den Sieg, die Zweiten um Platz 3 und so weiter.'
        :'In der Gruppe spielt jeder gegen jeden. Das Playoff entsteht von selbst, sobald alle Gruppenspiele ein Ergebnis haben.'})),
    !cfg&&h('p',{class:'app-note',text:'Für ein Turnier braucht es mindestens 2 Teams.'}),
  ];
};

// ── Running: groups ──
const COLS=[['#','Rang','c-rank'],['Team','Team','c-name'],['Sp','Spiele','c-opt'],['S','Siege',''],['N','Niederlagen',''],['Diff','Satzdifferenz','c-pts']];
const sign=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
const groupBlock=(ev,grp,parts,cfg,tiedGroups,canEdit)=>{
  const rows=tableOf(grp,parts);
  const team=id=>parts.teams.find(t=>t.id===id);
  const ms=parts.matches.filter(m=>m.stage==='group'&&team(m.team1Id)?.grp===grp).sort((a,b)=>a.seq-b.seq);
  return h('section',{class:'app-section'},
    h('div',{class:'app-section__head'},h('h2',{class:'title-2',text:'Gruppe '+grp})),
    h('div',{class:'pc-card',style:{overflow:'hidden',marginBottom:'var(--space-3)'}},
      h('table',{class:'pc-standings'},
        h('thead',null,h('tr',null,COLS.map(([abbr,word,cls])=>
          h('th',{class:cls||null,title:word,scope:'col',style:cls==='c-name'?{textAlign:'left'}:null,text:abbr})))),
        h('tbody',null,rows.map(r=>h('tr',{class:(r.rank===1&&r.played>0&&!r.tied?'is-leader':'')+(cfg.mode==='playoff'&&r.rank>cfg.advance?' app-unranked':'')||null},
          h('td',{class:'c-rank'},h('b',{text:String(r.rank)})),
          h('td',{class:'c-name',text:teamLabel(team(r.id))}),
          h('td',{class:'c-opt',text:String(r.played)}),
          h('td',{text:String(r.wins)}),
          h('td',{text:String(r.losses)}),
          h('td',{class:'c-pts',text:sign(r.sd)})))))),
    tiedGroups.includes(grp)&&h('div',{class:'pc-card app-pad',style:{marginBottom:'var(--space-3)'}},
      h('div',{class:'title-3',text:'Gleichstand in Gruppe '+grp}),
      h('p',{class:'app-note',text:'Siege, Sätze, Games und der direkte Vergleich sind gleich. Das Los entscheidet die Reihenfolge.'}),
      canEdit&&h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
        btn('primary','Los ziehen',()=>confirmSheet({
          title:'Los ziehen?',
          text:'Die Reihenfolge der punktgleichen Teams in Gruppe '+grp+' wird ausgelost. Danach geht es mit der nächsten Runde weiter.',
          action:'Los ziehen',onConfirm:()=>drawTiebreak(ev.id,grp)}),{icon:'shuffle'}))),
    h('div',{class:'app-list'},ms.map(m=>eventMatchCard(ev,m))));
};

// ── Running: playoff ──
const placing=(parts)=>{
  const of=s=>parts.matches.filter(m=>m.stage===s).sort((a,b)=>a.seq-b.seq);
  const p=parts.config.mode==='placement'?placementPlacing(parts):finalPlacing({final:of('final')[0],third:of('third')[0],semis:of('semi')});
  // Shown once the winner is known.
  if(!p||!p.length||p[0].place!==1)return null;
  const label=id=>teamLabel(parts.teams.find(t=>t.id===id));
  return h('div',{class:'pc-hero'},
    h('div',{class:'pc-hero__label',text:'Turniersieger'}),
    h('div',{class:'pc-season__title',style:{margin:'var(--space-2) 0 var(--space-3)'},text:label(p[0].teamId)}),
    p.slice(1).map(x=>h('div',{class:'pc-hero__muted pc-num',text:x.place+'. '+label(x.teamId)})));
};
const playoff=(ev,parts,tiedGroups)=>{
  const stages=['place','quarter','semi','third','final'].map(s=>[s,parts.matches.filter(m=>m.stage===s).sort((a,b)=>a.seq-b.seq)]).filter(([,ms])=>ms.length>0);
  if(!stages.length)return h('p',{class:'app-note',style:{marginTop:'var(--space-6)'},
    text:tiedGroups.length?'Vorher muss das Los in Gruppe '+tiedGroups.join(', ')+' entscheiden (Reiter Gruppen).'
      :'Es geht von selbst weiter, sobald alle Gruppenspiele ein Ergebnis haben.'});
  return[
    h('div',{class:'app-section'},placing(parts)),
    stages.map(([stage,ms])=>h('section',{class:'app-section'},
      h('div',{class:'app-section__head'},h('h2',{class:'title-2',text:STAGE_LABEL[stage]})),
      h('div',{class:'app-list'},ms.map(m=>eventMatchCard(ev,m))))),
  ];
};

export const renderClassic=ev=>{
  const ep=getEP(ev.id),teams=getTeams(ev.id),ms=getMat(ev.id);
  const canEdit=IS_PLAYER&&ev.status!=='completed';
  const started=ms.length>0;
  const parts={config:ev.config||{},teams,matches:ms};
  const reset=canEdit&&teams.length>0&&btn('danger',started?'Turnier zurücksetzen':'Teams verwerfen',()=>confirmSheet({
    title:started?'Turnier zurücksetzen?':'Teams verwerfen?',
    text:started?'Alle Teams, Gruppen und Ergebnisse von '+ev.name+' werden gelöscht. Danach beginnst du wieder bei der Auswahl der Spieler.'
      :'Die Paare werden aufgelöst. Danach kannst du die Teilnehmer ändern und neu auslosen.',
    action:started?'Zurücksetzen':'Verwerfen',danger:true,onConfirm:()=>resetTournament(ev.id)}));

  let body;
  if(!teams.length)body=pickTeams(ev,ep,canEdit);
  else if(!started)body=pickSetup(ev,teams,canEdit);
  else{
    const cfg=classicConfig(ev.config,teams.length);
    const tiedGroups=classicNext(parts).tied;
    const hasPlayoff=ms.some(m=>m.stage!=='group');
    const sub=S.sub==='groups'||S.sub==='playoff'?S.sub:hasPlayoff?'playoff':'groups';
    body=[
      h('div',{class:'app-switch'},segmented('Ansicht',[['groups','Gruppen'],['playoff',cfg.mode==='placement'?'Platzierung':'Playoff']],sub,v=>{S.sub=v;notify();})),
      sub==='playoff'?playoff(ev,parts,tiedGroups)
        :[h('p',{class:'app-note',style:{marginTop:'var(--space-4)'},text:cfg.mode==='placement'?'Danach spielt jeder Gruppenrang gegen denselben Rang der anderen Gruppe.'
          :'Aus jeder Gruppe '+(cfg.advance===1?'kommt das erste Team':'kommen die ersten '+cfg.advance+' Teams')+' weiter.'}),
          groupsOf(teams).map(g=>groupBlock(ev,g,parts,cfg,tiedGroups,canEdit))],
    ];
  }
  return h('main',{class:'app-screen pc-enter'},
    eventHead(ev,overlineOf(ev,teams.length>0&&teams.length+' Teams')),body,eventSection(ev,[reset]));
};
