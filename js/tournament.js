// Tournament logic: Americano and the classic format (groups, then playoffs).
// Pure: no DOM, no storage, no global state. Randomness comes in as `rnd`.
import {shuf,roundRobin} from './logic.js';

const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;

// Splits `items` into pairs with the lowest total cost(a,b). Exact search
// with pruning; a step budget keeps very large fields responsive (the best
// pairing found so far is used then).
const bestPairing=(items,cost)=>{
  let best=null,bestCost=Infinity,steps=0;
  const used=new Array(items.length).fill(false),cur=[];
  const go=(sum)=>{
    if(sum>=bestCost||bestCost===0||steps>200000)return;
    const i=used.indexOf(false);
    if(i<0){best=cur.map(p=>[...p]);bestCost=sum;return;}
    used[i]=true;
    const options=[];
    for(let j=i+1;j<items.length;j++)if(!used[j])options.push([cost(items[i],items[j]),j]);
    options.sort((x,y)=>x[0]-y[0]);
    for(const [c,j] of options){
      steps++;
      used[j]=true;cur.push([items[i],items[j]]);
      go(sum+c);
      cur.pop();used[j]=false;
    }
    used[i]=false;
  };
  go(0);
  return best;
};

// ─── Americano ────────────────────────────────────────────────

const perRound=(n,courts)=>Math.min(courts,Math.floor(n/4));

// Rounds needed for everyone to partner everyone once.
export const americanoRounds=(n,courts)=>Math.ceil(n*(n-1)/(4*perRound(n,courts)));

// Perfectly balanced rounds for 4, 8 and 16 players: over n-1 rounds everyone
// partners everyone exactly once and (from 8 players) faces everyone exactly
// twice. Seats are numbered 0..n-1 and treated as elements of the finite
// field with n elements: in round d, seat x partners seat x+d, and a match is
// the four seats {x, x+d, x+αd, x+d+αd}. Addition in these fields is XOR.
const FIELD_POLY={4:0b111,8:0b1011,16:0b10011};
const fieldRound=(order,r)=>{
  const n=order.length,d=1+r%(n-1);
  const timesAlpha=v=>{const s=v<<1;return s>=n?s^FIELD_POLY[n]:s;};
  const e=timesAlpha(d),seen=new Set(),games=[];
  for(let x=0;x<n;x++){
    if(seen.has(x))continue;
    [x,x^d,x^e,x^d^e].forEach(s=>seen.add(s));
    games.push([[order[x],order[x^d]],[order[x^e],order[x^d^e]]]);
  }
  return games;
};

// Round `r` of the classic rotation: one player stays, the others move one
// seat. Over n-1 rounds every two players sit together exactly once.
const rotationPairs=(order,r)=>{
  const n=order.length,rest=order.slice(1),k=r%(n-1);
  const seats=[order[0],...rest.slice(k),...rest.slice(0,k)];
  const pairs=[];
  for(let i=0;i<n/2;i++)pairs.push([seats[i],seats[n-1-i]]);
  return pairs;
};

// Returns [{round, matches:[{court, team1:[a,b], team2:[c,d]}], resting:[ids]}]
export const americanoSchedule=(playerIds,{courts=1,rounds,rnd=Math.random}={})=>{
  const n=playerIds.length;
  if(n<4)throw new Error('Americano braucht mindestens 4 Spieler.');
  if(new Set(playerIds).size!==n)throw new Error('Ein Spieler ist doppelt in der Liste.');
  if(!(courts>=1))throw new Error('Mindestens ein Platz nötig.');
  const mpr=perRound(n,courts);
  const total=rounds??americanoRounds(n,courts);
  const everyonePlays=n%4===0&&mpr===n/4;
  const order=shuf(playerIds,rnd);
  const toRounds=(games,resting)=>games.map((g,r)=>({
    round:r+1,
    matches:g.map(([t1,t2],i)=>({court:i+1,team1:[...t1],team2:[...t2]})),
    resting:playerIds.filter(p=>resting[r].includes(p)),
  }));

  if(everyonePlays&&FIELD_POLY[n]){
    return toRounds(Array.from({length:total},(_,r)=>shuf(fieldRound(order,r),rnd)),Array.from({length:total},()=>[]));
  }

  const partner={},opponent={},rests={};
  playerIds.forEach(p=>{rests[p]=0;});
  const count=(m,a,b)=>m[pairKey(a,b)]||0;

  // 1. Who rests and who partners whom, round by round.
  const roundsPairs=[],restingPerRound=[];
  for(let r=0;r<total;r++){
    let resting=[],pairs;
    if(everyonePlays){
      pairs=rotationPairs(order,r);
    }else{
      // Fewest rests so far rest next; chance decides among equals.
      const byRest=shuf(playerIds,rnd).sort((a,b)=>rests[a]-rests[b]);
      resting=byRest.slice(0,n-4*mpr);
      pairs=bestPairing(byRest.slice(n-4*mpr),(a,b)=>count(partner,a,b)**2);
    }
    pairs.forEach(([a,b])=>{const k=pairKey(a,b);partner[k]=(partner[k]||0)+1;});
    resting.forEach(p=>{rests[p]++;});
    roundsPairs.push(shuf(pairs,rnd));restingPerRound.push(resting);
  }

  // 2. Which pair meets which. Aim: opponents spread as evenly as possible
  // over the whole schedule (smallest sum of squared meeting counts). Each
  // round is set in turn given all the others, repeated until nothing improves.
  const meet=(games,d)=>{for(const [x,y] of games)for(const a of x)for(const b of y){const k=pairKey(a,b);opponent[k]=(opponent[k]||0)+d;}};
  const choose=pairs=>bestPairing(pairs,(x,y)=>{let s=0;for(const a of x)for(const b of y)s+=2*count(opponent,a,b)+1;return s;});
  const spread=()=>Object.values(opponent).reduce((s,v)=>s+v*v,0);
  const games=roundsPairs.map(pairs=>{const g=choose(pairs);meet(g,1);return g;});
  for(let sweep=0;sweep<20;sweep++){
    let improved=false;
    for(let r=0;r<total;r++){
      const before=spread();
      meet(games[r],-1);
      const g=choose(roundsPairs[r]);
      meet(g,1);
      if(spread()<before){games[r]=g;improved=true;}
      else{meet(g,-1);meet(games[r],1);}
    }
    if(!improved)break;
  }
  return toRounds(games,restingPerRound);
};

// Ranking of an Americano. matches: [{team1:[a,b], team2:[c,d], s1, s2}],
// s1/s2 = points of each team, null while unplayed.
export const americanoStandings=(playerIds,matches)=>{
  const acc=Object.fromEntries(playerIds.map(id=>[id,{id,played:0,pts:0,diff:0,wins:0}]));
  for(const m of matches){
    if(m.s1==null||m.s2==null)continue;
    const side=(team,own,other)=>team.forEach(id=>{const a=acc[id];if(!a)return;a.played++;a.pts+=own;a.diff+=own-other;if(own>other)a.wins++;});
    side(m.team1,m.s1,m.s2);side(m.team2,m.s2,m.s1);
  }
  const rows=Object.values(acc);
  const most=Math.max(0,...rows.map(r=>r.played));
  // Who played fewer matches gets their own average for each missing one.
  rows.forEach(r=>{r.adjPts=r.played?Math.round((r.pts+r.pts/r.played*(most-r.played))*10)/10:0;});
  return rows.sort((a,b)=>b.adjPts-a.adjPts||b.diff-a.diff||b.wins-a.wins).map((r,i)=>({...r,rank:i+1}));
};
