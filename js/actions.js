// Everything that changes data. Views ask for confirmation where needed
// (a sheet); the functions here just do the change.
import {fmtDate,dmy,ymd} from './dom.js';
import {uid,S,displaySeason,activeSeason,getEP,matByRnd,standings,mut,IS_ADMIN} from './store.js';
import {teamName,drawTeams,roundRobin,withoutEvent,seasonForDate} from './logic.js';

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
export const addEvent=date=>{
  const id=uid();
  let done=false;
  const season=seasonForDate(S.seasons,date)||activeSeason();
  mut(()=>{S.events.push({id,sid:season.id,name:'Padel Day '+dmy(date),date,status:'planned'});done=true;});
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
  pairs.forEach(({p1,p2})=>S.teams.push({id:uid(),eid,rnd,player1Id:p1.id,player2Id:p2.id,name:teamName(p1,p2)}));
  S.matches=S.matches.filter(m=>!(m.eid===eid&&m.rnd===rnd));
});

export const genMatches=(eid,rnd)=>{
  const et=S.teams.filter(t=>t.eid===eid&&t.rnd===rnd);if(et.length<2)return;
  mut(()=>{
    S.matches=S.matches.filter(m=>!(m.eid===eid&&m.rnd===rnd));
    let seq=1;
    roundRobin(et.map(t=>t.id)).forEach(([a,b])=>
      S.matches.push({id:uid(),eid,rnd,seq:seq++,team1Id:a,team2Id:b,t1s1:null,t2s1:null,t1s2:null,t2s2:null,t1s3:null,t2s3:null,winnerTeamId:null,status:'scheduled'}));
    const ev=S.events.find(e=>e.id===eid);if(ev)ev.status='active';
  });
};

// A match can be deleted as long as its event is not completed.
export const deleteMatch=id=>{
  const m=S.matches.find(x=>x.id===id);if(!m)return;
  const ev=S.events.find(e=>e.id===m.eid);if(ev&&ev.status==='completed')return;
  mut(()=>{S.matches=S.matches.filter(x=>x.id!==id);});
};

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
  const allRnds=[...new Set(S.teams.filter(t=>t.eid===eid).map(t=>t.rnd))].sort((a,b)=>a-b);
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
      const won=m.winnerTeamId===m.team1Id?n1:m.winnerTeamId===m.team2Id?n2:'nicht gespielt';
      lines.push(n1+' vs '+n2+' — '+fmtScore(m)+' (Sieg: '+won+')');
    });
    if(rm.length===0)lines.push('(keine abgeschlossenen Matches)');
    lines.push('');
  });
  dlFile(lines.join('\n'),ev.name.replace(/\s+/g,'_')+'_'+ymd(ev.date)+'.txt','text/plain;charset=utf-8');
};
