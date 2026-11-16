// Everything that changes data. Views ask for confirmation where needed
// (a sheet); the functions here just do the change.
import {fmtDate,dmy,ymd} from './dom.js';
import {uid,S,displaySeason,activeSeason,getEP,matByRnd,standings,mut,IS_ADMIN} from './store.js';
import {teamName,drawTeams,roundRobin,withoutEvent,seasonForDate,calcWinner,checkScore,checkPoints,shuf} from './logic.js';
import {americanoSchedule,americanoConfig,classicConfig,drawGroups,groupMatches,classicNext,classicEditable,tableOf} from './tournament.js';

// ─── Players ──────────────────────────────────────────────────
export const addPlayer=name=>{
  if(!IS_ADMIN)return;
  mut(()=>{S.players.push({id:uid(),name,isActive:true});});
};
// Players are never deleted, so old results keep their names. Admin only.
export const setPlayerActive=(id,active)=>{
  if(!IS_ADMIN)return;
  mut(()=>{const p=S.players.find(x=>x.id===id);if(p)p.isActive=active;});
};

// ─── Events ───────────────────────────────────────────────────
// Creates a Padel Day in the season its date belongs to and returns its id
// (or null when this access may not change anything).
const EVENT_WORD={padel_day:'Padel Day',americano:'Americano',classic:'Turnier'};
export const addEvent=(date,format='padel_day')=>{
  const id=uid();
  let done=false;
  const season=seasonForDate(S.seasons,date)||activeSeason();
  mut(()=>{S.events.push({id,sid:season.id,name:EVENT_WORD[format]+' '+dmy(date),date,status:'planned',format,config:{}});done=true;});
  return done?id:null;
};
// Puts an event into another season; its results count there from then on. Admin only.
export const moveEvent=(eid,sid)=>{
  if(!IS_ADMIN||!S.seasons.some(s=>s.id===sid))return;
  mut(()=>{const ev=S.events.find(e=>e.id===eid);if(ev)ev.sid=sid;});
};
export const completeEvent=eid=>mut(()=>{const ev=S.events.find(e=>e.id===eid);if(ev)ev.status='completed';});
// Removes an event with all its rounds and results. Admin only.
export const deleteEvent=eid=>{
  if(!IS_ADMIN||!S.events.some(e=>e.id===eid))return;
  mut(()=>{Object.assign(S,withoutEvent(S,eid));S.selEv=null;});
};
export const toggleParticipant=(eid,pid)=>mut(()=>{
  const has=S.evP.some(x=>x.eid===eid&&x.pid===pid);
  if(has)S.evP=S.evP.filter(x=>!(x.eid===eid&&x.pid===pid));
  else S.evP.push({eid,pid});
});

// ─── Teams and matches ────────────────────────────────────────
export const genTeams=(eid,rnd)=>{
  const ps=getEP(eid);if(ps.length<2)return;
  const {pairs,bye}=drawTeams(ps,(S.byeMap[eid]||{})[rnd-1]||null);
  applyManualTeams(eid,rnd,pairs,bye);
};

export const applyManualTeams=(eid,rnd,pairs,bye)=>mut(()=>{
  S.byeMap={...S.byeMap,[eid]:{...(S.byeMap[eid]||{}),[rnd]:bye?bye.id:null}};
  S.teams=S.teams.filter(t=>!(t.eid===eid&&t.rnd===rnd));
  pairs.forEach(({p1,p2})=>S.teams.push({id:uid(),eid,rnd,player1Id:p1.id,player2Id:p2.id,name:teamName(p1,p2),grp:null}));
  S.matches=S.matches.filter(m=>!(m.eid===eid&&m.rnd===rnd));
});

export const genMatches=(eid,rnd)=>{
  const et=S.teams.filter(t=>t.eid===eid&&t.rnd===rnd);if(et.length<2)return;
  mut(()=>{
    S.matches=S.matches.filter(m=>!(m.eid===eid&&m.rnd===rnd));
    let seq=1;
    roundRobin(et.map(t=>t.id)).forEach(([a,b])=>
      S.matches.push({id:uid(),eid,rnd,seq:seq++,team1Id:a,team2Id:b,stage:null,court:null,t1s1:null,t2s1:null,t1s2:null,t2s2:null,t1s3:null,t2s3:null,winnerTeamId:null,status:'scheduled'}));
    const ev=S.events.find(e=>e.id===eid);if(ev)ev.status='active';
  });
};

// A match can be deleted as long as its event is not completed.
export const deleteMatch=id=>{
  const m=S.matches.find(x=>x.id===id);if(!m)return;
  const ev=S.events.find(e=>e.id===m.eid);if(ev&&ev.status==='completed')return;
  mut(()=>{S.matches=S.matches.filter(x=>x.id!==id);});
};

// ─── Results ──────────────────────────────────────────────────
const eventOf=m=>S.events.find(e=>e.id===m.eid);
const emptyScore={t1s1:null,t2s1:null,t1s2:null,t2s2:null,t1s3:null,t2s3:null,winnerTeamId:null,status:'scheduled'};
const eventParts=ev=>({config:ev.config||{},teams:S.teams.filter(t=>t.eid===ev.id),matches:S.matches.filter(m=>m.eid===ev.id)});
// Creates the next stage of a classic tournament when the current one is
// decided. Call inside a change.
const advanceClassic=ev=>{
  classicNext(eventParts(ev)).add.forEach(n=>S.matches.push({id:uid(),eid:ev.id,team1Id:n.team1Id,team2Id:n.team2Id,rnd:n.rnd,seq:n.seq,stage:n.stage,court:null,...emptyScore}));
};

// Saves a result in sets. sets = [{t1, t2}, ...]. Returns {ok, error}.
// In a tournament every match needs a winner, and a result is closed once
// the next stage has started.
export const saveScore=(matchId,sets)=>{
  const m=S.matches.find(x=>x.id===matchId);if(!m)return{ok:false,error:'Match nicht gefunden.'};
  const ev=eventOf(m),classic=ev&&ev.format==='classic';
  if(ev&&ev.status==='completed')return{ok:false,error:'Dieses Event ist abgeschlossen.'};
  const chk=checkScore(sets);
  if(!chk.ok)return{ok:false,error:chk.error};
  if(classic&&chk.notPlayed)return{ok:false,error:'Im Turnier braucht jedes Match einen Sieger.'};
  if(classic&&!classicEditable(m,eventParts(ev).matches))return{ok:false,error:'Die nächste Runde läuft schon. Dieses Ergebnis lässt sich nicht mehr ändern.'};
  const s=chk.notPlayed?sets.slice(0,1):sets;
  let saved=false;
  mut(()=>{
    m.t1s1=s[0]?.t1??null;m.t2s1=s[0]?.t2??null;
    m.t1s2=s[1]?.t1??null;m.t2s2=s[1]?.t2??null;
    m.t1s3=s[2]?.t1??null;m.t2s3=s[2]?.t2??null;
    m.status='completed';m.winnerTeamId=calcWinner(m);
    if(classic)advanceClassic(ev);
    saved=true;
  });
  return saved?{ok:true,error:null}:{ok:false,error:'Dieser Zugang darf keine Ergebnisse eintragen.'};
};

// Saves an Americano result: the points of each team. Returns {ok, error}.
export const saveAmericanoScore=(matchId,a,b)=>{
  const m=S.matches.find(x=>x.id===matchId);if(!m)return{ok:false,error:'Match nicht gefunden.'};
  const ev=eventOf(m);
  if(ev&&ev.status==='completed')return{ok:false,error:'Dieses Event ist abgeschlossen.'};
  const total=americanoConfig(ev&&ev.config,getEP(m.eid).length).points;
  const chk=checkPoints(a,b,total);
  if(!chk.ok)return chk;
  let saved=false;
  mut(()=>{Object.assign(m,emptyScore,{t1s1:a,t2s1:b,status:'completed',winnerTeamId:a>b?m.team1Id:b>a?m.team2Id:null});saved=true;});
  return saved?{ok:true,error:null}:{ok:false,error:'Dieser Zugang darf keine Ergebnisse eintragen.'};
};

// Takes a result back, so the match is open again.
export const resetScore=matchId=>{
  const m=S.matches.find(x=>x.id===matchId);if(!m)return;
  const ev=eventOf(m);
  if(ev&&ev.status==='completed')return;
  if(ev&&ev.format==='classic'&&!classicEditable(m,eventParts(ev).matches))return;
  mut(()=>{Object.assign(m,emptyScore);});
};

// ─── Tournaments ──────────────────────────────────────────────
export const setEventConfig=(eid,patch)=>mut(()=>{
  const ev=S.events.find(e=>e.id===eid);if(ev)ev.config={...(ev.config||{}),...patch};
});

// Creates the whole Americano schedule: per match two teams and the match.
export const startAmericano=eid=>{
  const ev=S.events.find(e=>e.id===eid),ps=getEP(eid);
  if(!ev||ps.length<4)return;
  const cfg=americanoConfig(ev.config,ps.length);
  const schedule=americanoSchedule(ps.map(p=>p.id),{courts:cfg.courts,rounds:cfg.rounds});
  const byId=id=>ps.find(p=>p.id===id);
  mut(()=>{
    S.teams=S.teams.filter(t=>t.eid!==eid);S.matches=S.matches.filter(m=>m.eid!==eid);
    for(const r of schedule)for(const g of r.matches){
      const [t1,t2]=[g.team1,g.team2].map(([a,b])=>{
        const t={id:uid(),eid,rnd:r.round,player1Id:a,player2Id:b,name:teamName(byId(a),byId(b)),grp:null};
        S.teams.push(t);return t;
      });
      S.matches.push({id:uid(),eid,team1Id:t1.id,team2Id:t2.id,rnd:r.round,seq:g.court,stage:null,court:g.court,...emptyScore});
    }
    ev.config=cfg;ev.status='active';
  });
};

// Draws the fixed pairs of a classic tournament (an even number of players).
export const drawClassicTeams=eid=>{
  const ps=getEP(eid);
  if(ps.length<4||ps.length%2!==0)return;
  applyManualTeams(eid,0,drawTeams(ps,null).pairs,null);
};

// Draws the groups and creates the group matches.
export const startClassic=eid=>{
  const ev=S.events.find(e=>e.id===eid);if(!ev)return;
  const teams=S.teams.filter(t=>t.eid===eid);
  const cfg=classicConfig(ev.config,teams.length);
  if(!cfg)return;
  const groups=drawGroups(teams.map(t=>t.id),cfg.groups);
  mut(()=>{
    S.matches=S.matches.filter(m=>m.eid!==eid);
    let seq=0;
    groups.forEach((ids,i)=>{
      const grp='ABCD'[i];
      ids.forEach(id=>{teams.find(t=>t.id===id).grp=grp;});
      groupMatches(ids).forEach(([a,b])=>S.matches.push({id:uid(),eid,team1Id:a,team2Id:b,rnd:1,seq:++seq,stage:'group',court:null,...emptyScore}));
    });
    ev.config={groups:cfg.groups,advance:cfg.advance,sets:cfg.sets,thirdPlace:cfg.thirdPlace};
    ev.status='active';
  });
};

// Lets chance settle the order of the teams still level in a group, then
// starts the playoff if nothing else is in the way.
export const drawTiebreak=(eid,grp)=>{
  const ev=S.events.find(e=>e.id===eid);if(!ev)return;
  const tied=tableOf(grp,eventParts(ev)).filter(r=>r.tied).map(r=>r.id);
  if(!tied.length)return;
  mut(()=>{
    ev.config={...ev.config,tiebreak:{...((ev.config||{}).tiebreak||{}),[grp]:shuf(tied)}};
    advanceClassic(ev);
  });
};

// Back to the setup: removes teams, schedule and results of a tournament.
export const resetTournament=eid=>mut(()=>{
  const ev=S.events.find(e=>e.id===eid);if(!ev)return;
  S.teams=S.teams.filter(t=>t.eid!==eid);S.matches=S.matches.filter(m=>m.eid!==eid);
  const {tiebreak,...rest}=ev.config||{};
  ev.config=rest;ev.status='planned';
});

// ─── Settings ─────────────────────────────────────────────────
export const setPoints=(key,value)=>mut(()=>{S.settings[key]=value;});
export const addSeason=(name,startDate,endDate)=>mut(()=>{S.seasons.push({id:uid(),name,startDate,endDate,isActive:false});});
export const activateSeason=id=>mut(()=>{S.seasons.forEach(x=>{x.isActive=x.id===id;});});
export const clearGameData=()=>mut(()=>{S.events=[];S.evP=[];S.teams=[];S.matches=[];S.byeMap={};});
export const clearEverything=()=>mut(()=>{S.events=[];S.evP=[];S.teams=[];S.matches=[];S.byeMap={};S.players=[];S.settings={ptsWin:3,ptsLoss:0};});

// ─── Exports ──────────────────────────────────────────────────
const dlFile=(content,filename,mime)=>{
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);
};
export const exportCSV=()=>{
  const st=standings();
  const hdr='Rang,Spieler,Siege%,Spiele,Siege,Niederlagen,Satzdiff,Gamediff,Punkte,In Wertung\n';
  const rows=st.map(s=>`${s.rank},"${s.player.name}",${s.pct}%,${s.mp},${s.w},${s.l},${s.sd},${s.gd},${s.pts},${s.qualified?'ja':'nein'}`).join('\n');
  dlFile('﻿'+hdr+rows,'Rangliste_'+displaySeason().name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.csv','text/csv;charset=utf-8');
};
export const exportTXT=(eid)=>{
  const ev=S.events.find(e=>e.id===eid);if(!ev)return;
  const allRnds=[...new Set(S.matches.filter(m=>m.eid===eid).map(m=>m.rnd))].sort((a,b)=>a-b);
  const gp=id=>S.players.find(p=>p.id===id);
  const fmtScore=m=>{const sets=[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].filter(([a])=>a!=null);return sets.map(([a,b])=>a+' : '+b).join(', ');};
  const lines=[ev.name+' — '+fmtDate(ev.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),''];
  allRnds.forEach(rnd=>{
    lines.push('── Runde '+rnd+' ──');
    const rm=matByRnd(eid,rnd).filter(m=>m.status==='completed');
    rm.forEach(m=>{
      const t1=S.teams.find(t=>t.id===m.team1Id),t2=S.teams.find(t=>t.id===m.team2Id);if(!t1||!t2)return;
      const n1=(gp(t1.player1Id)?.name||'?')+' & '+(gp(t1.player2Id)?.name||'?');
      const n2=(gp(t2.player1Id)?.name||'?')+' & '+(gp(t2.player2Id)?.name||'?');
      const won=m.winnerTeamId===m.team1Id?n1:m.winnerTeamId===m.team2Id?n2:ev.format==='americano'?'unentschieden':'nicht gespielt';
      lines.push(n1+' vs '+n2+' — '+fmtScore(m)+' (Sieg: '+won+')');
    });
    if(rm.length===0)lines.push('(keine abgeschlossenen Matches)');
    lines.push('');
  });
  dlFile(lines.join('\n'),ev.name.replace(/\s+/g,'_')+'_'+ymd(ev.date)+'.txt','text/plain;charset=utf-8');
};
