// Pure game logic. No DOM, no storage, no global state: everything comes in
// as arguments, so it runs unchanged in the browser and in tests.

export const shuf=(arr,rnd=Math.random)=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};

export const calcWinner=m=>{let s1=0,s2=0;[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].forEach(([a,b])=>{if(a!=null&&b!=null){if(a>b)s1++;else if(b>a)s2++;}});return s1>s2?m.team1Id:s2>s1?m.team2Id:null;};

// Checks a result before it is saved. sets = [{t1, t2}, ...]
// All sets 0:0 means "did not take place". Anything else needs a winner.
export const checkScore=sets=>{
  const res=(ok,notPlayed,error)=>({ok,notPlayed,error});
  if(!sets.length)return res(false,false,'Kein Ergebnis eingetragen.');
  if(sets.every(s=>s.t1===0&&s.t2===0))return res(true,true,null);
  const tie=sets.findIndex(s=>s.t1===s.t2);
  if(tie>=0)return res(false,false,'Satz '+(tie+1)+' ist unentschieden. Bitte korrigieren.');
  const w1=sets.filter(s=>s.t1>s.t2).length;
  if(w1*2===sets.length)return res(false,false,'Kein Sieger: Beide Teams haben gleich viele Sätze. Bitte einen Entscheidungssatz eintragen.');
  return res(true,false,null);
};

// Position in a colour list for an id. Numeric ids keep the colour they
// always had; other ids (random ones) get a stable one from their text.
export const colorIndex=(id,n)=>{
  const s=String(id??0);
  if(/^\d+$/.test(s))return parseInt(s)%n;
  let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))>>>0;
  return h%n;
};

export const teamName=(p1,p2)=>p1.name.split(' ')[0]+' / '+p2.name.split(' ')[0];

// Random pairs. With an odd number one player sits out (bye), but never the
// player who sat out the round before.
export const drawTeams=(players,prevByeId,rnd=Math.random)=>{
  if(players.length<2)return{pairs:[],bye:null};
  let sh=shuf(players,rnd),bye=null,toTeam=sh;
  if(sh.length%2!==0){
    if(prevByeId&&sh[sh.length-1].id===prevByeId){const si=Math.floor(rnd()*(sh.length-1));[sh[si],sh[sh.length-1]]=[sh[sh.length-1],sh[si]];}
    bye=sh[sh.length-1];toTeam=sh.slice(0,-1);
  }
  const pairs=[];
  for(let i=0;i<toTeam.length;i+=2)pairs.push({p1:toTeam[i],p2:toTeam[i+1]});
  return{pairs,bye};
};

// Everyone against everyone, once.
export const roundRobin=ids=>{
  const out=[];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)out.push([ids[i],ids[j]]);
  return out;
};

// The parts of the state that change when an event is removed with all its
// participants, teams, matches and byes. Does not modify its input.
export const withoutEvent=(state,eid)=>{
  const byeMap={...state.byeMap};delete byeMap[eid];
  return{
    events:state.events.filter(e=>e.id!==eid),
    evP:state.evP.filter(x=>x.eid!==eid),
    teams:state.teams.filter(t=>t.eid!==eid),
    matches:state.matches.filter(m=>m.eid!==eid),
    byeMap,
  };
};

// Season ranking per player. state = {players, events, teams, matches, settings}
export const calcStandings=(state,seasonId)=>{
  const eids=new Set(state.events.filter(e=>e.sid===seasonId).map(e=>e.id));
  const cms=state.matches.filter(m=>m.status==='completed'&&eids.has(m.eid));
  const acc={};
  const ga=id=>{if(!acc[id])acc[id]={w:0,l:0,sw:0,sl:0,gw:0,gl:0};return acc[id];};
  const cs=(a,b)=>a!=null&&b!=null&&a>b?1:0;
  state.players.filter(p=>p.isActive).forEach(p=>ga(p.id));
  for(const m of cms){
    // No winner (0:0) means the match did not take place: it counts for nobody.
    if(m.winnerTeamId!==m.team1Id&&m.winnerTeamId!==m.team2Id)continue;
    const t1=state.teams.find(t=>t.id===m.team1Id),t2=state.teams.find(t=>t.id===m.team2Id);
    if(!t1||!t2)continue;
    const s1=cs(m.t1s1,m.t2s1)+cs(m.t1s2,m.t2s2)+cs(m.t1s3,m.t2s3);
    const s2=cs(m.t2s1,m.t1s1)+cs(m.t2s2,m.t1s2)+cs(m.t2s3,m.t1s3);
    const g1=(m.t1s1||0)+(m.t1s2||0)+(m.t1s3||0),g2=(m.t2s1||0)+(m.t2s2||0)+(m.t2s3||0);
    const t1w=m.winnerTeamId===m.team1Id,t2w=m.winnerTeamId===m.team2Id;
    [t1.player1Id,t1.player2Id].forEach(pid=>{const a=ga(pid);if(t1w)a.w++;else a.l++;a.sw+=s1;a.sl+=s2;a.gw+=g1;a.gl+=g2;});
    [t2.player1Id,t2.player2Id].forEach(pid=>{const a=ga(pid);if(t2w)a.w++;else a.l++;a.sw+=s2;a.sl+=s1;a.gw+=g2;a.gl+=g1;});
  }
  return Object.entries(acc).map(([pid,a])=>{
    const mp=a.w+a.l,pts=a.w*state.settings.ptsWin+a.l*(state.settings.ptsLoss||0);
    return{player:state.players.find(p=>p.id===pid),pts,w:a.w,l:a.l,mp,sd:a.sw-a.sl,gd:a.gw-a.gl,pct:mp>0?Math.round(a.w/mp*100):0};
  }).filter(s=>s.player).sort((a,b)=>b.pts-a.pts||b.sd-a.sd||b.gd-a.gd||b.mp-a.mp).map((s,i)=>({...s,rank:i+1}));
};
