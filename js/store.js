import {calcStandings} from './logic.js';
import {toRows,fromRows,diffOps} from './sync.js';

export const uid=()=>crypto.randomUUID();

// ─── Access ───────────────────────────────────────────────────
// The key comes from the URL (?key=...). The server decides what it may do;
// the app only learns the resulting role.
export const urlKey=new URLSearchParams(location.search).get('key')||'';
export let IS_ADMIN=false,IS_PLAYER=false;
// loading | ok | nokey | badkey | offline
export let ACCESS='loading';
// Text of the red banner while a change is not stored on the server, else null.
export let SAVE_ERROR=null;

export const SK='padelchamp_v1';
const API_URL='https://yldwlgeabmwdjefeerpr.supabase.co/functions/v1/api';

// One call to the server. Throws with .status (HTTP code, or undefined when
// the server could not be reached at all).
export const api=async(body)=>{
  const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'application/json','x-pc-key':urlKey},body:JSON.stringify(body)});
  let data=null;try{data=await res.json();}catch{}
  if(!res.ok){const e=new Error((data&&data.error)||('HTTP '+res.status));e.status=res.status;e.detail=data&&data.detail;throw e;}
  return data;
};

// ─── Local copy (shown when the server cannot be reached) ─────
const DATA=['players','seasons','events','evP','teams','matches','byeMap','settings'];
const emptyData=()=>({players:[],seasons:[],events:[],evP:[],teams:[],matches:[],byeMap:{},settings:{ptsWin:3,ptsLoss:0}});
const loadLocal=()=>{try{const r=localStorage.getItem(SK);return r?JSON.parse(r):null;}catch{return null;}};
const saveLocal=()=>{try{localStorage.setItem(SK,JSON.stringify(Object.fromEntries(DATA.map(k=>[k,S[k]]))));}catch(e){console.warn('localStorage save failed',e);}};

// ─── State ────────────────────────────────────────────────────
export const S={
  ...emptyData(),
  ...(loadLocal()||{}),
  tab:       0,
  selEv:     null,
  selSeason: null,
};

// ─── Derived getters ──────────────────────────────────────────
const NO_SEASON=Object.freeze({id:'',name:'–',startDate:'',endDate:'',isActive:true});
export const activeSeason=()=>S.seasons.find(s=>s.isActive)||S.seasons[0]||NO_SEASON;
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
const _listeners=[];
export const onChange=fn=>{_listeners.push(fn);};
export const notify=()=>{_listeners.forEach(fn=>fn());};

// ─── Server sync ──────────────────────────────────────────────
// `synced` holds the rows the server last confirmed. A save sends only the
// difference between `synced` and the current state, so rows this device
// never touched are never overwritten or deleted.
let synced=toRows(emptyData());
let saving=false,failures=0,retryTimer=null;

const adopt=rows=>{
  const data=fromRows(rows);
  synced=toRows(data);
  Object.assign(S,data);
  saveLocal();
};
const pending=()=>diffOps(synced,toRows(S));
export const hasUnsaved=()=>saving||pending().length>0;

// Loads everything from the server and learns the role of the key.
export const loadRemote=async()=>{
  if(!urlKey){ACCESS='nokey';return;}
  try{
    const {role,state}=await api({action:'state'});
    IS_ADMIN=role==='admin';IS_PLAYER=IS_ADMIN||role==='player';
    adopt(state);ACCESS='ok';
  }catch(e){
    if(e.status===401){ACCESS='badkey';IS_ADMIN=IS_PLAYER=false;return;}
    // Server not reachable: keep showing the local copy, read-only.
    console.warn('load failed',e);
    if(ACCESS!=='ok')ACCESS='offline';
  }
};

const scheduleRetry=()=>{
  clearTimeout(retryTimer);
  retryTimer=setTimeout(flush,10000);
  if(retryTimer&&retryTimer.unref)retryTimer.unref();
};

// Sends unsaved changes. One request at a time; changes made meanwhile go
// out in the next round.
export const flush=async()=>{
  if(saving)return;
  const next=toRows(S),ops=diffOps(synced,next);
  if(!ops.length)return;
  saving=true;
  let again=false;
  try{
    await api({action:'ops',ops});
    synced=next;failures=0;SAVE_ERROR=null;again=true;
  }catch(e){
    failures++;
    const refused=e.status===400||e.status===403||(e.status>=500&&failures>=3);
    if(refused){
      // The server will not take this change. Drop it and show the server's state again.
      failures=0;SAVE_ERROR=null;
      alert(e.status===403?'🔒 Dieser Zugang darf das nicht ändern. Die Änderung wurde verworfen.':'⚠️ Die Änderung konnte nicht gespeichert werden und wurde verworfen.'+(e.detail?'\n\n'+e.detail:''));
      saving=false;
      await loadRemote();notify();
      return;
    }
    console.warn('save failed',e);
    SAVE_ERROR='⚠️ Nicht gespeichert — neuer Versuch läuft';
    scheduleRetry();
  }finally{
    saving=false;
  }
  notify();
  if(again&&pending().length)return flush();
};

// Picks up what other devices changed. Skipped while this device has
// unsaved changes, so they are not overwritten.
export const refresh=async()=>{
  if(ACCESS!=='ok'&&ACCESS!=='offline')return;
  // Offline means the first load never succeeded: nothing can be unsaved yet.
  if(ACCESS==='offline'){await loadRemote();notify();return;}
  if(hasUnsaved())return;
  try{
    const {state}=await api({action:'state'});
    if(hasUnsaved())return;
    if(diffOps(synced,toRows(fromRows(state))).length){adopt(state);notify();}
  }catch(e){console.warn('refresh failed',e);}
};

export const startSync=()=>{
  const t=setInterval(()=>{if(document.visibilityState==='visible')refresh();},15000);
  if(t&&t.unref)t.unref();
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refresh();});
};

// ─── Actions ─────────────────────────────────────────────────
export const mut=(fn)=>{
  if(ACCESS!=='ok'){alert('📡 Keine Verbindung zum Server. Änderungen sind gerade nicht möglich.');return;}
  if(!IS_PLAYER){alert('🔒 Read-only. Spieler- oder Admin-URL benötigt.');return;}
  fn();saveLocal();notify();flush();
};
