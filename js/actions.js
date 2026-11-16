import {fmtDate,ymd} from './dom.js';
import {uid,S,displaySeason,getEP,matByRnd,standings,mut,IS_ADMIN} from './store.js';
import {teamName,drawTeams,roundRobin,withoutEvent} from './logic.js';

// Players are never deleted, so old results keep their names. Admin only.
export const setPlayerActive=(id,active)=>{
  if(!IS_ADMIN){alert('🔒 Nur mit Admin-URL können Spieler geändert werden.');return;}
  mut(()=>{const p=S.players.find(x=>x.id===id);if(p)p.isActive=active;});
};

// Removes an event with all its rounds and results. Admin only.
export const deleteEvent=(eid)=>{
  if(!IS_ADMIN){alert('🔒 Nur mit Admin-URL können Events gelöscht werden.');return;}
  const ev=S.events.find(e=>e.id===eid);if(!ev)return;
  if(!confirm('«'+ev.name+'» mit allen Runden und Ergebnissen löschen? Die Ergebnisse verschwinden aus der Rangliste. Kann nicht rückgängig gemacht werden.'))return;
  mut(()=>{Object.assign(S,withoutEvent(S,eid));S.selEv=null;});
};

// ─── Actions ─────────────────────────────────────────────────
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

export const deleteMatch=(id)=>{
  const m=S.matches.find(x=>x.id===id);if(!m)return;
  const ev=S.events.find(e=>e.id===m.eid);if(ev&&ev.status==='completed')return;
  if(!confirm('Dieses Match löschen? Ein evtl. Ergebnis wird aus der Rangliste entfernt.'))return;
  mut(()=>{S.matches=S.matches.filter(x=>x.id!==id);});
};

// ─── Download helper ──────────────────────────────────────────
export const dlFile=(content,filename,mime)=>{
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();
  setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);
};
export const exportCSV=()=>{
  const st=standings();
  const hdr='Rang,Spieler,Punkte,Spiele,Siege,Niederlagen,Siege%,Satzdiff,Gamediff\n';
  const rows=st.map(s=>`${s.rank},"${s.player.name}",${s.pts},${s.mp},${s.w},${s.l},${s.pct}%,${s.sd},${s.gd}`).join('\n');
  dlFile('\uFEFF'+hdr+rows,'Rangliste_'+displaySeason().name.replace(/\s+/g,'_')+'_'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.csv','text/csv;charset=utf-8');
};
export const exportTXT=(eid)=>{
  const ev=S.events.find(e=>e.id===eid);if(!ev)return;
  const allRnds=[...new Set(S.teams.filter(t=>t.eid===eid).map(t=>t.rnd))].sort((a,b)=>a-b);
  const gp=id=>S.players.find(p=>p.id===id);
  const fmtScore=m=>{const sets=[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].filter(([a])=>a!=null);return sets.map(([a,b])=>a+':'+b).join(', ');};
  const lines=[ev.name+' — '+fmtDate(ev.date,{weekday:'long',day:'numeric',month:'long',year:'numeric'}),''];
  allRnds.forEach(rnd=>{
    lines.push('── Runde '+rnd+' ──');
    const rm=matByRnd(eid,rnd).filter(m=>m.status==='completed');
    rm.forEach(m=>{
      const t1=S.teams.find(t=>t.id===m.team1Id),t2=S.teams.find(t=>t.id===m.team2Id);if(!t1||!t2)return;
      const n1=(gp(t1.player1Id)?.name||'?')+' + '+(gp(t1.player2Id)?.name||'?');
      const n2=(gp(t2.player1Id)?.name||'?')+' + '+(gp(t2.player2Id)?.name||'?');
      const won=m.winnerTeamId===m.team1Id?n1:m.winnerTeamId===m.team2Id?n2:'nicht gespielt';
      lines.push(n1+' vs '+n2+' — '+fmtScore(m)+' (Sieg: '+won+')');
    });
    if(rm.length===0)lines.push('(keine abgeschlossenen Matches)');
    lines.push('');
  });
  dlFile(lines.join('\n'),ev.name.replace(/\s+/g,'_')+'_'+ymd(ev.date)+'.txt','text/plain;charset=utf-8');
};
