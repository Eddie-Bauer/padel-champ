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

// ─── Classic: groups, then playoffs ───────────────────────────

const PLAYOFF_SIZES=[2,4,8];

// The setups that can be offered for a number of teams: 1, 2 or 4 groups of
// at least two, and as many teams advancing per group that the playoff has
// 2, 4 or 8 teams (so the bracket never needs a bye).
export const classicOptions=nTeams=>{
  const out=[];
  for(const groups of [1,2,4]){
    const smallest=Math.floor(nTeams/groups);
    if(smallest<2)continue;
    for(let advance=1;advance<=smallest;advance++){
      if(PLAYOFF_SIZES.includes(groups*advance))out.push({groups,advance,playoffSize:groups*advance});
    }
  }
  return out;
};

// Random groups whose sizes differ by at most one.
export const drawGroups=(teamIds,groups,rnd=Math.random)=>{
  const out=Array.from({length:groups},()=>[]);
  shuf(teamIds,rnd).forEach((id,i)=>out[i%groups].push(id));
  return out;
};

// Everyone against everyone inside a group.
export const groupMatches=teamIds=>roundRobin(teamIds);

const winnerOf=m=>m&&m.status==='completed'&&(m.winnerTeamId===m.team1Id||m.winnerTeamId===m.team2Id)?m.winnerTeamId:null;
const loserOf=m=>{const w=winnerOf(m);return w?(w===m.team1Id?m.team2Id:m.team1Id):null;};
const setsOf=m=>[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].filter(([a,b])=>a!=null&&b!=null);

// Table of one group. Order: wins, set difference, game difference, then the
// matches among the teams still level. Teams that are level even then share
// `tied: true` until `tiebreak` (ids in the order the organiser confirmed)
// settles them. Matches without a winner are ignored.
export const groupTable=(teamIds,matches,tiebreak=[])=>{
  const inGroup=new Set(teamIds);
  const ms=matches.filter(m=>winnerOf(m)&&inGroup.has(m.team1Id)&&inGroup.has(m.team2Id));
  const acc=Object.fromEntries(teamIds.map(id=>[id,{id,played:0,wins:0,losses:0,sd:0,gd:0}]));
  for(const m of ms){
    const a=acc[m.team1Id],b=acc[m.team2Id],sets=setsOf(m);
    const s1=sets.filter(([x,y])=>x>y).length,s2=sets.filter(([x,y])=>y>x).length;
    const g1=sets.reduce((s,[x])=>s+x,0),g2=sets.reduce((s,[,y])=>s+y,0);
    a.played++;b.played++;
    if(winnerOf(m)===m.team1Id){a.wins++;b.losses++;}else{b.wins++;a.losses++;}
    a.sd+=s1-s2;b.sd+=s2-s1;a.gd+=g1-g2;b.gd+=g2-g1;
  }
  const level=(a,b)=>a.wins===b.wins&&a.sd===b.sd&&a.gd===b.gd;
  const sorted=Object.values(acc).sort((a,b)=>b.wins-a.wins||b.sd-a.sd||b.gd-a.gd);

  // Orders a block of level teams by the matches among themselves.
  const settle=block=>{
    if(block.length===1)return[{...block[0],tied:false}];
    const members=new Set(block.map(r=>r.id)),mini=Object.fromEntries(block.map(r=>[r.id,0]));
    for(const m of ms)if(members.has(m.team1Id)&&members.has(m.team2Id))mini[winnerOf(m)]++;
    const byMini=[...block].sort((a,b)=>mini[b.id]-mini[a.id]);
    const parts=[];
    for(const r of byMini){const last=parts[parts.length-1];if(last&&mini[last[0].id]===mini[r.id])last.push(r);else parts.push([r]);}
    if(parts.length>1)return parts.flatMap(settle);
    // Still level: the confirmed draw decides, if it covers all of them.
    if(block.every(r=>tiebreak.includes(r.id))){
      return[...block].sort((a,b)=>tiebreak.indexOf(a.id)-tiebreak.indexOf(b.id)).map(r=>({...r,tied:false}));
    }
    return block.map(r=>({...r,tied:true}));
  };

  const out=[];
  for(let i=0;i<sorted.length;){
    let j=i+1;while(j<sorted.length&&level(sorted[i],sorted[j]))j++;
    out.push(...settle(sorted.slice(i,j)));
    i=j;
  }
  return out.map((r,i)=>({...r,rank:i+1,tied:r.tied}));
};

// First playoff round. `tables`: per group the team ids in table order.
// Bracket order: the winners of pairs 1 and 2 meet next, then 3 and 4.
export const seedPlayoff=(tables,advance)=>{
  const g=tables.length,size=g*advance;
  if(![1,2,4].includes(g)||!PLAYOFF_SIZES.includes(size))throw new Error('Diese Kombination aus Gruppen und Aufsteigern wird nicht angeboten.');
  if(tables.some(t=>t.length<advance))throw new Error('Zu wenig Teams in einer Gruppe für '+advance+' Aufsteiger.');
  const [ga,gb,gc,gd]=tables;
  const stage={2:'final',4:'semi',8:'quarter'}[size];
  let pairs;
  if(g===1){
    pairs={2:[[ga[0],ga[1]]],4:[[ga[0],ga[3]],[ga[1],ga[2]]],8:[[ga[0],ga[7]],[ga[3],ga[4]],[ga[1],ga[6]],[ga[2],ga[5]]]}[size];
  }else if(g===2){
    pairs={2:[[ga[0],gb[0]]],4:[[ga[0],gb[1]],[gb[0],ga[1]]],8:[[ga[0],gb[3]],[gb[1],ga[2]],[gb[0],ga[3]],[ga[1],gb[2]]]}[size];
  }else{
    pairs={4:[[ga[0],gb[0]],[gc[0],gd[0]]],8:[[ga[0],gb[1]],[gc[0],gd[1]],[gb[0],ga[1]],[gd[0],gc[1]]]}[size];
  }
  return{stage,pairs};
};

const STAGE_MATCHES={quarter:4,semi:2,final:1};

// The round after `stage`, from its matches in bracket order. Returns null
// while a match is open or has no winner; [] after the final.
export const nextPlayoffRound=(stage,matches,{thirdPlace=false}={})=>{
  if(stage==='final')return[];
  if(matches.length!==STAGE_MATCHES[stage]||!matches.every(winnerOf))return null;
  const w=matches.map(winnerOf);
  if(stage==='quarter')return[{stage:'semi',team1Id:w[0],team2Id:w[1]},{stage:'semi',team1Id:w[2],team2Id:w[3]}];
  const out=[];
  if(thirdPlace)out.push({stage:'third',team1Id:loserOf(matches[0]),team2Id:loserOf(matches[1])});
  out.push({stage:'final',team1Id:w[0],team2Id:w[1]});
  return out;
};

// Places 1 to 4 once the final is decided, else null. Without a decided
// match for third place both semi-final losers are third.
export const finalPlacing=({final,third,semis}={})=>{
  if(!winnerOf(final))return null;
  const out=[{place:1,teamId:winnerOf(final)},{place:2,teamId:loserOf(final)}];
  if(winnerOf(third))out.push({place:3,teamId:winnerOf(third)},{place:4,teamId:loserOf(third)});
  else if(semis)semis.filter(winnerOf).forEach(m=>out.push({place:3,teamId:loserOf(m)}));
  return out;
};

// ─── Classic: the tournament as a whole ───────────────────────

export const STAGE_LABEL={group:'Gruppenphase',quarter:'Viertelfinal',semi:'Halbfinal',third:'Spiel um Platz 3',final:'Final'};
// Round number per stage (third place and final are played in the same round).
const STAGE_RND={group:1,quarter:2,semi:3,third:4,final:4};
const NEXT_STAGE={quarter:'semi',semi:'final'};
const stageMatches=(matches,stage)=>matches.filter(m=>m.stage===stage).sort((a,b)=>a.seq-b.seq);
const planned=(stage,i,a,b)=>({stage,rnd:STAGE_RND[stage],seq:stage==='final'?2:i+1,team1Id:a,team2Id:b});

// The group letters of a tournament, in order.
export const groupsOf=teams=>[...new Set(teams.map(t=>t.grp).filter(Boolean))].sort();
// Table of one group of a running tournament.
export const tableOf=(grp,{config,teams,matches})=>
  groupTable(teams.filter(t=>t.grp===grp).map(t=>t.id),stageMatches(matches,'group'),((config||{}).tiebreak||{})[grp]||[]);

// What has to be created next. `teams`: [{id, grp}], `matches`: all matches
// of the event. Returns {add, tied}: `add` are the matches of the next
// stage (empty while the current one is unfinished or once the final
// exists); `tied` are the groups where a draw has to settle the order first.
export const classicNext=({config,teams,matches})=>{
  const none={add:[],tied:[]};
  const started=['quarter','semi','final'].some(s=>stageMatches(matches,s).length>0);
  if(!started){
    const gm=stageMatches(matches,'group');
    if(!gm.length||!gm.every(winnerOf))return none;
    const groups=groupsOf(teams);
    const tables=groups.map(g=>tableOf(g,{config,teams,matches}));
    // Only a tie that reaches into the advancing places matters.
    const tied=groups.filter((g,i)=>tables[i].some(r=>r.tied&&r.rank<=config.advance));
    if(tied.length)return{add:[],tied};
    const {stage,pairs}=seedPlayoff(tables.map(t=>t.map(r=>r.id)),config.advance);
    return{add:pairs.map(([a,b],i)=>planned(stage,i,a,b)),tied:[]};
  }
  for(const stage of ['quarter','semi']){
    const ms=stageMatches(matches,stage);
    if(!ms.length||stageMatches(matches,NEXT_STAGE[stage]).length)continue;
    const next=nextPlayoffRound(stage,ms,{thirdPlace:!!config.thirdPlace});
    if(!next)return none;
    let i=0;
    return{add:next.map(n=>planned(n.stage,n.stage==='third'?0:i++,n.team1Id,n.team2Id)),tied:[]};
  }
  return none;
};

// A result may be changed until the stage after it has started.
export const classicEditable=(match,matches)=>{
  const has=s=>matches.some(m=>m.stage===s);
  if(match.stage==='group')return!has('quarter')&&!has('semi')&&!has('final');
  if(match.stage==='quarter')return!has('semi');
  if(match.stage==='semi')return!has('final');
  return true;
};

// ─── Americano: from stored rows ──────────────────────────────

// Stored teams and matches as results per player, for americanoStandings.
// The points of a match are kept in the first set fields.
export const americanoResults=(teams,matches)=>{
  const pair=id=>{const t=teams.find(x=>x.id===id);return t?[t.player1Id,t.player2Id]:null;};
  return matches.map(m=>{
    const team1=pair(m.team1Id),team2=pair(m.team2Id);
    if(!team1||!team2)return null;
    const done=m.status==='completed';
    return{team1,team2,s1:done?m.t1s1:null,s2:done?m.t2s1:null};
  }).filter(Boolean);
};

// Who sits out in a round: every participant who is in no team of it.
export const restingIn=(playerIds,teams,rnd)=>{
  const playing=new Set(teams.filter(t=>t.rnd===rnd).flatMap(t=>[t.player1Id,t.player2Id]));
  return playerIds.filter(p=>!playing.has(p));
};

// ─── Setup values with defaults ───────────────────────────────

export const AMERICANO_POINTS=[16,21,24,32];

// The Americano setup that applies for `n` players: what was chosen, limited
// to what is possible, with defaults for the rest.
export const americanoConfig=(config,n)=>{
  const c=config||{},maxCourts=Math.max(1,Math.floor(n/4));
  const courts=Math.min(Math.max(1,c.courts||maxCourts),maxCourts);
  const points=AMERICANO_POINTS.includes(c.points)?c.points:21;
  const rounds=c.rounds>0?c.rounds:(n>=4?americanoRounds(n,courts):0);
  return{courts,points,rounds};
};

// The classic setup that applies for a number of teams, or null when there
// are too few. Without a valid choice: the first setup with semi-finals.
export const classicConfig=(config,nTeams)=>{
  const c=config||{},options=classicOptions(nTeams);
  if(!options.length)return null;
  const pick=options.find(o=>o.groups===c.groups&&o.advance===c.advance)||options.find(o=>o.playoffSize===4)||options[0];
  return{...pick,sets:c.sets==='one'?'one':'bo3',thirdPlace:!!c.thirdPlace&&pick.playoffSize>=4};
};
