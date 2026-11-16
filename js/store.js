import {calcStandings} from './logic.js';

let _uid=Date.now();
export const uid=()=>String(++_uid);

// ─── Storage ──────────────────────────────────────────────────
// ─── Admin Key ────────────────────────────────────────────────
export const ADMIN_HASH='f14e1db32940958d55e859906ed0a51254a3d749231cb573a787c5e742e606a8';
export const PLAYER_HASH='c53c03452b0e56554d66fa73de1fc44451b07844a8aa445db34bf48ffa198cf2';
export const urlKey=new URLSearchParams(location.search).get('key')||'';
async function _sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
export let IS_ADMIN=false,IS_PLAYER=false;
export async function initAuth(){
  const h=await _sha256(urlKey);
  IS_ADMIN=h===ADMIN_HASH;
  IS_PLAYER=IS_ADMIN||(h===PLAYER_HASH);
}

export const SK='padelchamp_v1';
export const SB_URL='https://yldwlgeabmwdjefeerpr.supabase.co';
export const SB_KEY='sb_publishable_mrL1kVUYLjoiyKJMtJ20KA_ZRelO6BC';
export const SB_HDR={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json'};

export const _sbLoad=async()=>{
  try{
    const U=SB_URL+'/rest/v1/';
    const G=t=>fetch(U+t,{headers:SB_HDR}).then(r=>r.json());
    const [pl,se,ev,ep,tm,ma,bm,st]=await Promise.all([
      G('players?select=*'),G('seasons?select=*'),G('events?select=*'),
      G('event_players?select=*'),G('teams?select=*'),G('matches?select=*'),
      G('bye_map?select=*'),G('settings?id=eq.1&select=*')
    ]);
    const byeMap={};
    bm.forEach(r=>{if(!byeMap[r.event_id])byeMap[r.event_id]={};byeMap[r.event_id][r.rnd]=r.player_id;});
    return{
      players:pl.map(p=>({id:p.id,name:p.name,isActive:p.is_active})),
      seasons:se.map(s=>({id:s.id,name:s.name,startDate:s.start_date,endDate:s.end_date,isActive:s.is_active})),
      events:ev.map(e=>({id:e.id,sid:e.season_id,date:e.date,name:e.name,status:e.status})),
      evP:ep.map(e=>({eid:e.event_id,pid:e.player_id})),
      teams:tm.map(t=>({id:t.id,eid:t.event_id,rnd:t.rnd,player1Id:t.player1_id,player2Id:t.player2_id,name:t.name})),
      matches:ma.map(m=>({id:m.id,eid:m.event_id,team1Id:m.team1_id,team2Id:m.team2_id,rnd:m.rnd,seq:m.seq,t1s1:m.t1s1,t2s1:m.t2s1,t1s2:m.t1s2,t2s2:m.t2s2,t1s3:m.t1s3,t2s3:m.t2s3,winnerTeamId:m.winner_team_id,status:m.status})),
      byeMap,
      settings:st.length?{ptsWin:st[0].pts_win,ptsLoss:st[0].pts_loss}:{ptsWin:3,ptsLoss:0}
    };
  }catch(e){console.warn('Supabase load failed',e);return null;}
};

export const _sbSave=async(payload)=>{
  const U=SB_URL+'/rest/v1/';
  const UP={...SB_HDR,'Prefer':'resolution=merge-duplicates,return=minimal'};
  const ups=(t,rows)=>rows.length?fetch(U+t,{method:'POST',headers:UP,body:JSON.stringify(rows)}):Promise.resolve();
  const del=(t,q)=>fetch(`${U}${t}?${q}`,{method:'DELETE',headers:SB_HDR});
  const notIn=(ids)=>ids.length?`id=not.in.(${ids.join(',')})`:null;
  try{
    await ups('players',payload.players.map(p=>({id:p.id,name:p.name,is_active:p.isActive})));
    const pq=notIn(payload.players.map(p=>p.id));if(pq)await del('players',pq);
    await ups('seasons',payload.seasons.map(s=>({id:s.id,name:s.name,start_date:s.startDate,end_date:s.endDate,is_active:s.isActive})));
    const sq=notIn(payload.seasons.map(s=>s.id));if(sq)await del('seasons',sq);
    await ups('events',payload.events.map(e=>({id:e.id,season_id:e.sid,date:e.date,name:e.name,status:e.status||'scheduled'})));
    if(payload.events.length){
      await del('event_players',`event_id=in.(${payload.events.map(e=>e.id).join(',')})`);
      await ups('event_players',payload.evP.map(e=>({event_id:e.eid,player_id:e.pid})));
    }
    await ups('teams',payload.teams.map(t=>({id:t.id,event_id:t.eid,rnd:t.rnd,player1_id:t.player1Id,player2_id:t.player2Id,name:t.name})));
    const tq=notIn(payload.teams.map(t=>t.id));if(tq)await del('teams',tq);
    await ups('matches',payload.matches.map(m=>({id:m.id,event_id:m.eid,team1_id:m.team1Id,team2_id:m.team2Id,rnd:m.rnd,seq:m.seq,t1s1:m.t1s1,t2s1:m.t2s1,t1s2:m.t1s2,t2s2:m.t2s2,t1s3:m.t1s3,t2s3:m.t2s3,winner_team_id:m.winnerTeamId,status:m.status})));
    const mq=notIn(payload.matches.map(m=>m.id));if(mq)await del('matches',mq);
    if(payload.events.length){
      await del('bye_map',`event_id=in.(${payload.events.map(e=>e.id).join(',')})`);
      const br=[];
      Object.entries(payload.byeMap||{}).forEach(([eid,rnds])=>{Object.entries(rnds).forEach(([rnd,pid])=>{if(pid)br.push({event_id:eid,rnd:parseInt(rnd),player_id:pid});});});
      await ups('bye_map',br);
    }
    // Removed events go last, after everything that points at them.
    if(payload.events.length){
      const gone=`event_id=not.in.(${payload.events.map(e=>e.id).join(',')})`;
      for(const t of ['matches','teams','event_players','bye_map'])await del(t,gone);
    }
    const eq2=notIn(payload.events.map(e=>e.id));if(eq2)await del('events',eq2);
    await fetch(`${U}settings?id=eq.1`,{method:'PATCH',headers:{...SB_HDR,'Prefer':'return=minimal'},body:JSON.stringify({pts_win:payload.settings.ptsWin,pts_loss:payload.settings.ptsLoss||0})});
  }catch(e){console.warn('Supabase save error:',e);}
};

export const loadDB=()=>{try{const r=localStorage.getItem(SK);return r?JSON.parse(r):null;}catch{return null;}};
export const saveDB=()=>{
  const payload={players:S.players,seasons:S.seasons,events:S.events,evP:S.evP,teams:S.teams,matches:S.matches,byeMap:S.byeMap,settings:S.settings};
  try{localStorage.setItem(SK,JSON.stringify(payload));}catch(e){console.warn('localStorage save failed',e);}
  if(IS_PLAYER)_sbSave(payload);
};

// ─── State ────────────────────────────────────────────────────
export const saved=loadDB();
export const S={
  players:   saved?.players  || [{id:'1',name:'Klaus',isActive:true},{id:'2',name:'Zlate',isActive:true},{id:'3',name:'Marion',isActive:true},{id:'4',name:'Vitomir',isActive:true},{id:'5',name:'Goran',isActive:true},{id:'6',name:'Bojan',isActive:true}],
  seasons:   saved?.seasons  || [{id:'s1',name:'Q2 2025',startDate:'2025-04-01',endDate:'2025-06-30',isActive:true}],
  events:    saved?.events   || [],
  evP:       saved?.evP      || [],
  teams:     saved?.teams    || [],
  matches:   saved?.matches  || [],
  byeMap:    saved?.byeMap   || {},
  settings:  saved?.settings || {ptsWin:3,ptsLoss:0},
  tab:       0,
  selEv:     null,
  selSeason: null,
};

// ─── Derived getters ──────────────────────────────────────────
export const activeSeason=()=>S.seasons.find(s=>s.isActive)||S.seasons[0];
export const displaySeason=()=>S.selSeason?S.seasons.find(s=>s.id===S.selSeason)||activeSeason():activeSeason();
export const getEP=eid=>S.evP.filter(ep=>ep.eid===eid).map(ep=>S.players.find(p=>p.id===ep.pid)).filter(Boolean);
export const getTeams=eid=>S.teams.filter(t=>t.eid===eid);
export const getMat=eid=>S.matches.filter(m=>m.eid===eid);
export const curRnd=eid=>{const et=getTeams(eid);return et.length===0?0:Math.max(...et.map(t=>t.rnd));};
export const matByRnd=(eid,rnd)=>S.matches.filter(m=>m.eid===eid&&m.rnd===rnd).sort((a,b)=>a.seq-b.seq);
export const teamByRnd=(eid,rnd)=>S.teams.filter(t=>t.eid===eid&&t.rnd===rnd);
export const rndDone=(eid,rnd)=>{const rm=matByRnd(eid,rnd);return rm.length>0&&rm.every(m=>m.status==='completed');};
export const getEv=()=>S.events.find(e=>e.id===S.selEv);

// ─── Standings for the season on display ─────────────────────
export const standings=()=>calcStandings(S,displaySeason().id);

// ─── Change notification (main.js registers render here) ─────
export const _listeners=[];
export const onChange=fn=>{_listeners.push(fn);};
export const notify=()=>{_listeners.forEach(fn=>fn());};

// ─── Actions ─────────────────────────────────────────────────
export const mut=(fn)=>{if(!IS_PLAYER){alert('🔒 Read-only. Spieler- oder Admin-URL benötigt.');return;}fn();saveDB();notify();};

// ─── Load from Supabase (authoritative) ──────────────────────
export const loadRemote=async()=>{
  const sbData=await _sbLoad();
  if(sbData&&sbData.seasons&&sbData.seasons.length>0){
    // Supabase has data — use it as source of truth
    S.players=sbData.players;S.seasons=sbData.seasons;S.events=sbData.events;
    S.evP=sbData.evP;S.teams=sbData.teams;S.matches=sbData.matches;
    S.byeMap=sbData.byeMap;S.settings=sbData.settings;
    try{localStorage.setItem(SK,JSON.stringify(sbData));}catch(e){}
  } else if(sbData&&IS_PLAYER){
    // Supabase empty — migrate localStorage data to Supabase
    _sbSave({players:S.players,seasons:S.seasons,events:S.events,evP:S.evP,teams:S.teams,matches:S.matches,byeMap:S.byeMap,settings:S.settings});
  }
};
