// KI-Analyse: a short commentary on the season, written by the AI.
import {h,first} from '../dom.js';
import {api,S,displaySeason,standings} from '../store.js';
import {openSheet} from '../sheet.js';

const setsText=m=>[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].filter(([a])=>a!=null).map(([a,b])=>a+':'+b).join(', ');
const nameOf=id=>first(S.players.find(p=>p.id===id)?.name);
const teamOf=id=>S.teams.find(t=>t.id===id);

// The three questions and the data each one gets.
const buildPrompts=()=>{
  const ds=displaySeason(),st=standings();
  const evs=S.events.filter(e=>e.sid===ds.id).sort((a,b)=>b.date.localeCompare(a.date));
  const played=m=>m.status==='completed'&&m.winnerTeamId;

  const rankingText=st.map((x,i)=>`${i+1}. ${x.player.name}: ${x.pts} Pkt, ${x.w}S/${x.l}N, ${x.pct}% Siegquote, Satzdiff ${x.sd>0?'+':''}${x.sd}${x.qualified?'':' (noch außer Wertung, zu wenige Spiele)'}`).join('\n');

  const evText=evs.slice(0,5).map(ev=>{
    const ms=S.matches.filter(m=>m.eid===ev.id&&played(m));
    const rnds=[...new Set(ms.map(m=>m.rnd))].sort((a,b)=>a-b);
    return ev.name+':\n'+rnds.map(rnd=>'Runde '+rnd+': '+ms.filter(m=>m.rnd===rnd).map(m=>{
      const t1=teamOf(m.team1Id),t2=teamOf(m.team2Id);
      if(!t1||!t2)return'';
      return`${nameOf(t1.player1Id)}/${nameOf(t1.player2Id)} vs ${nameOf(t2.player1Id)}/${nameOf(t2.player2Id)} [${setsText(m)}]`;
    }).filter(Boolean).join(' | ')).join('\n');
  }).join('\n\n');

  // Wins and losses per pair over the whole season.
  const pairs={};
  S.matches.filter(m=>evs.some(e=>e.id===m.eid)&&played(m)).forEach(m=>{
    const t1=teamOf(m.team1Id),t2=teamOf(m.team2Id);
    if(!t1||!t2)return;
    const add=(t,won)=>{const k=[nameOf(t.player1Id),nameOf(t.player2Id)].sort().join(' & ');if(!pairs[k])pairs[k]={w:0,l:0};won?pairs[k].w++:pairs[k].l++;};
    add(t1,m.winnerTeamId===t1.id);add(t2,m.winnerTeamId===t2.id);
  });
  const teamText=Object.entries(pairs).sort((a,b)=>b[1].w/(b[1].w+b[1].l)-a[1].w/(a[1].w+a[1].l))
    .map(([pair,s])=>`${pair}: ${s.w}S/${s.l}N (${Math.round(s.w/(s.w+s.l)*100)}%)`).join('\n');

  return{
    saison:`Du bist ein witziger, direkter Padel-Sportkommentator. Analysiere diese Saison-Daten auf Deutsch und schreib einen kurzen, unterhaltsamen Kommentar (max. 5-6 Sätze). Hebe 2-3 interessante Beobachtungen hervor: Wer dominiert, wer kämpft, Trends oder Überraschungen. Sei konkret, nenn Namen.\n\nSAISON: ${ds.name}\n\nRANGLISTE:\n${rankingText}\n\nLETZTE EVENTS:\n${evText}`,
    spieler:`Du bist ein Padel-Trainer und Statistik-Analyst. Analysiere die Performance jedes Spielers auf Deutsch (max. 6-7 Sätze gesamt). Für die Top 3 und Schlusslichter: Was sind Stärken, was Schwächen, welcher Trend ist erkennbar? Sei direkt, nenn Namen, keine Floskeln.\n\nSAISON: ${ds.name}\n\nRANGLISTE:\n${rankingText}`,
    team:`Du bist ein Padel-Taktikexperte. Analysiere auf Deutsch welche Spielerpaare am besten harmonieren (max. 5-6 Sätze). Wer ist das stärkste Duo? Gibt es Überraschungen — gute Paare die man nicht erwartet hätte? Welche Kombination sollte man vermeiden? Sei konkret, nenn Namen.\n\nSAISON: ${ds.name}\n\nTEAM-STATISTIKEN (Siegquote):\n${teamText||'Keine Daten verfügbar.'}`,
  };
};

const TYPES=[['saison','Saison'],['spieler','Spieler'],['team','Team-Chemie']];

export const openKiAnalyse=()=>{
  const prompts=buildPrompts();
  const result=h('div',{class:'app-prose','aria-live':'polite'},
    h('p',{class:'pc-muted',text:'Wähle oben, was die KI kommentieren soll.'}));
  let running=0;
  const run=async(type,tab)=>{
    const mine=++running;
    seg.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b===tab)));
    result.replaceChildren(h('p',{class:'pc-muted',text:'Analyse läuft …'}));
    try{
      const data=await api({action:'analyze',prompt:prompts[type]});
      if(mine!==running)return;
      const text=data?.candidates?.[0]?.content?.parts?.[0]?.text||'Keine Antwort erhalten.';
      result.replaceChildren(...text.split('\n').filter(l=>l.trim()).map(line=>h('p',{text:line})));
    }catch(e){
      if(mine!==running)return;
      result.replaceChildren(h('p',{class:'app-error',text:'Die Analyse hat nicht geklappt: '+e.message}));
    }
  };
  const seg=h('div',{class:'pc-seg',role:'tablist','aria-label':'Art der Analyse'},
    TYPES.map(([type,label])=>{const b=h('button',{type:'button',role:'tab','aria-selected':'false',text:label});b.addEventListener('click',()=>run(type,b));return b;}));
  return openSheet({title:'KI-Analyse',body:[seg,result]});
};
