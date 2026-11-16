// Translation between the app's state and database rows, and the list of
// changes ("ops") that turns one set of rows into another. Pure: no DOM, no
// network.

// Parents before children. Upserts run in this order, deletes in DELETE_ORDER.
export const TABLES=['players','seasons','events','event_players','teams','matches','bye_map','settings'];
const DELETE_ORDER=['matches','teams','bye_map','event_players','events','seasons','players'];

// Which columns identify a row.
export const KEYS={
  players:['id'],seasons:['id'],events:['id'],teams:['id'],matches:['id'],settings:['id'],
  event_players:['event_id','player_id'],
  bye_map:['event_id','rnd'],
};

export const toRows=s=>({
  players:s.players.map(p=>({id:p.id,name:p.name,is_active:p.isActive})),
  seasons:s.seasons.map(x=>({id:x.id,name:x.name,start_date:x.startDate,end_date:x.endDate,is_active:x.isActive})),
  events:s.events.map(e=>({id:e.id,season_id:e.sid,date:e.date,name:e.name,status:e.status||'scheduled'})),
  event_players:s.evP.map(e=>({event_id:e.eid,player_id:e.pid})),
  teams:s.teams.map(t=>({id:t.id,event_id:t.eid,rnd:t.rnd,player1_id:t.player1Id,player2_id:t.player2Id,name:t.name})),
  matches:s.matches.map(m=>({id:m.id,event_id:m.eid,team1_id:m.team1Id,team2_id:m.team2Id,rnd:m.rnd,seq:m.seq,t1s1:m.t1s1,t2s1:m.t2s1,t1s2:m.t1s2,t2s2:m.t2s2,t1s3:m.t1s3,t2s3:m.t2s3,winner_team_id:m.winnerTeamId,status:m.status})),
  bye_map:Object.entries(s.byeMap||{}).flatMap(([eid,rnds])=>Object.entries(rnds).filter(([,pid])=>pid).map(([rnd,pid])=>({event_id:eid,rnd:parseInt(rnd),player_id:pid}))),
  settings:[{id:1,pts_win:s.settings.ptsWin,pts_loss:s.settings.ptsLoss||0}],
});

export const fromRows=r=>{
  const byeMap={};
  r.bye_map.forEach(b=>{if(!byeMap[b.event_id])byeMap[b.event_id]={};byeMap[b.event_id][b.rnd]=b.player_id;});
  const st=r.settings||[];
  return{
    players:r.players.map(p=>({id:p.id,name:p.name,isActive:p.is_active})),
    seasons:r.seasons.map(s=>({id:s.id,name:s.name,startDate:s.start_date,endDate:s.end_date,isActive:s.is_active})),
    events:r.events.map(e=>({id:e.id,sid:e.season_id,date:e.date,name:e.name,status:e.status})),
    evP:r.event_players.map(e=>({eid:e.event_id,pid:e.player_id})),
    teams:r.teams.map(t=>({id:t.id,eid:t.event_id,rnd:t.rnd,player1Id:t.player1_id,player2Id:t.player2_id,name:t.name})),
    matches:r.matches.map(m=>({id:m.id,eid:m.event_id,team1Id:m.team1_id,team2Id:m.team2_id,rnd:m.rnd,seq:m.seq,t1s1:m.t1s1,t2s1:m.t2s1,t1s2:m.t1s2,t2s2:m.t2s2,t1s3:m.t1s3,t2s3:m.t2s3,winnerTeamId:m.winner_team_id,status:m.status})),
    byeMap,
    settings:st.length?{ptsWin:st[0].pts_win,ptsLoss:st[0].pts_loss}:{ptsWin:3,ptsLoss:0},
  };
};

const keyOf=(t,row)=>Object.fromEntries(KEYS[t].map(k=>[k,row[k]]));
const index=(t,list)=>new Map((list||[]).map(row=>[JSON.stringify(keyOf(t,row)),row]));
// Compare by content, independent of the order the columns arrive in.
const same=(a,b)=>{const ka=Object.keys(a);return ka.length===Object.keys(b).length&&ka.every(k=>a[k]===b[k]);};

// The changes that turn `prev` into `next`. Only rows that differ between
// the two appear, so a row neither side knows about is never touched.
export const diffOps=(prev,next)=>{
  const ups=[],dels={};
  for(const t of TABLES){
    const a=index(t,prev[t]),b=index(t,next[t]);
    for(const [k,row] of b){const old=a.get(k);if(!old||!same(old,row))ups.push({t,a:'upsert',row});}
    dels[t]=[...a].filter(([k])=>!b.has(k)).map(([,row])=>({t,a:'delete',key:keyOf(t,row)}));
  }
  return[...ups,...DELETE_ORDER.flatMap(t=>dels[t])];
};
