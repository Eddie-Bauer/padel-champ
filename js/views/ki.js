import {C} from '../theme.js';
import {el,div,span} from '../dom.js';
import {urlKey,S,displaySeason,standings} from '../store.js';

// ── KI Analyse ────────────────────────────────────────────────
export const openKiAnalyse=async()=>{
  const ds=displaySeason();
  const st=standings();
  if(st.length===0){alert('Noch keine Ergebnisse für eine KI-Analyse.');return;}
  const evs=S.events.filter(e=>e.sid===ds.id).sort((a,b)=>b.date.localeCompare(a.date));
  const lastEvs=evs.slice(0,5);

  const rankingText=st.map((x,i)=>`${i+1}. ${x.player.name}: ${x.pts} Pkt, ${x.w}S/${x.l}N, ${x.pct}% Siegquote, Satzdiff ${x.sd>0?'+':''}${x.sd}`).join('\n');

  const evText=lastEvs.map(ev=>{
    const allM=S.matches.filter(m=>m.eid===ev.id&&m.status==='completed');
    const rnds=[...new Set(allM.map(m=>m.rnd))].sort((a,b)=>a-b);
    const lines=rnds.map(rnd=>{
      const rm=S.matches.filter(m=>m.eid===ev.id&&m.rnd===rnd&&m.status==='completed');
      return 'Runde '+rnd+': '+rm.map(m=>{
        const t1=S.teams.find(t=>t.id===m.team1Id),t2=S.teams.find(t=>t.id===m.team2Id);
        if(!t1||!t2)return '';
        const gp=id=>S.players.find(p=>p.id===id)?.name?.split(' ')[0]||'?';
        const score=[[m.t1s1,m.t2s1],[m.t1s2,m.t2s2],[m.t1s3,m.t2s3]].filter(([a])=>a!=null).map(([a,b])=>a+':'+b).join(', ');
        return `${gp(t1.player1Id)}/${gp(t1.player2Id)} vs ${gp(t2.player1Id)}/${gp(t2.player2Id)} [${score}]`;
      }).filter(Boolean).join(' | ');
    }).join('\n');
    return ev.name+':\n'+lines;
  }).join('\n\n');

  // Team chemistry: win/loss per player pair across all season events
  const pairStats={};
  S.matches.filter(m=>evs.find(e=>e.id===m.eid)&&m.status==='completed').forEach(m=>{
    const t1=S.teams.find(t=>t.id===m.team1Id),t2=S.teams.find(t=>t.id===m.team2Id);
    if(!t1||!t2)return;
    const gp=id=>S.players.find(p=>p.id===id)?.name?.split(' ')[0]||'?';
    const addPair=(t,won)=>{const key=[gp(t.player1Id),gp(t.player2Id)].sort().join(' & ');if(!pairStats[key])pairStats[key]={w:0,l:0};won?pairStats[key].w++:pairStats[key].l++;};
    const t1won=m.winnerTeamId===m.team1Id;addPair(t1,t1won);addPair(t2,!t1won);
  });
  const teamText=Object.entries(pairStats).filter(([,s])=>s.w+s.l>0).sort((a,b)=>(b[1].w/(b[1].w+b[1].l))-(a[1].w/(a[1].w+a[1].l))).map(([pair,s])=>`${pair}: ${s.w}S/${s.l}N (${Math.round(s.w/(s.w+s.l)*100)}%)`).join('\n');

  const overlay=div('overlay');
  const modal=div('modal fi');
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};

  const hdr=div('',{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'});
  hdr.appendChild(span('🤖 KI-Analyse',{fontSize:'17px',fontWeight:'700',color:C.text}));
  const xbtn=el('button',{style:{background:C.bg,border:'none',borderRadius:'8px',width:'32px',height:'32px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="'+C.sub+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>');
  xbtn.onclick=()=>overlay.remove();hdr.appendChild(xbtn);modal.appendChild(hdr);

  const seasonLabel=div('',{background:C.accentBg,borderRadius:'10px',padding:'8px 12px',marginBottom:'14px'});
  seasonLabel.appendChild(span(ds.name+' · '+st.length+' Spieler · '+evs.length+' Events',{fontSize:'12px',fontWeight:'600',color:C.accent}));
  modal.appendChild(seasonLabel);

  // Analysis type selector
  const typeBtns=div('',{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'});
  const resultDiv=div('',{fontSize:'14px',lineHeight:'1.65',color:C.text,minHeight:'80px'});

  const runAnalysis=async(type,activeBtn)=>{
    typeBtns.querySelectorAll('button').forEach(b=>b.style.opacity='0.5');
    activeBtn.style.opacity='1';
    resultDiv.innerHTML='';
    const loader=div('',{display:'flex',alignItems:'center',gap:'10px',padding:'12px 0'});
    loader.appendChild(span('⏳',{fontSize:'20px'}));
    loader.appendChild(span('Analyse läuft...',{fontSize:'14px',color:C.muted}));
    resultDiv.appendChild(loader);

    const prompts={
      saison:`Du bist ein witziger, direkter Padel-Sportkommentator. Analysiere diese Saison-Daten auf Deutsch und schreib einen kurzen, unterhaltsamen Kommentar (max. 5-6 Sätze). Hebe 2-3 interessante Beobachtungen hervor: Wer dominiert, wer kämpft, Trends oder Überraschungen. Sei konkret, nenn Namen.\n\nSAISON: ${ds.name}\n\nRANGLISTE:\n${rankingText}\n\nLETZTE EVENTS:\n${evText}`,
      spieler:`Du bist ein Padel-Trainer und Statistik-Analyst. Analysiere die Performance jedes Spielers auf Deutsch (max. 6-7 Sätze gesamt). Für die Top 3 und Schlusslichter: Was sind Stärken, was Schwächen, welcher Trend ist erkennbar? Sei direkt, nenn Namen, keine Floskeln.\n\nSAISON: ${ds.name}\n\nRANGLISTE:\n${rankingText}`,
      team:`Du bist ein Padel-Taktikexperte. Analysiere auf Deutsch welche Spielerpaare am besten harmonieren (max. 5-6 Sätze). Wer ist das stärkste Duo? Gibt es Überraschungen — gute Paare die man nicht erwartet hätte? Welche Kombination sollte man vermeiden? Sei konkret, nenn Namen.\n\nSAISON: ${ds.name}\n\nTEAM-STATISTIKEN (Siegquote):\n${teamText||'Keine Daten verfügbar.'}`
    };

    try{
      const resp=await fetch('https://yldwlgeabmwdjefeerpr.supabase.co/functions/v1/dynamic-endpoint',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prompt:prompts[type],playerKey:urlKey})
      });
      const data=await resp.json();
      if(data.error){throw new Error(data.error.message||data.error);}
      const text=data?.candidates?.[0]?.content?.parts?.[0]?.text||'Keine Antwort erhalten.';
      resultDiv.innerHTML='';
      text.split('\n').filter(l=>l.trim()).forEach(line=>{const p=document.createElement('p');p.textContent=line;p.style.marginBottom='10px';resultDiv.appendChild(p);});
    }catch(e){
      resultDiv.innerHTML='';
      resultDiv.appendChild(span('⚠️ Fehler: '+e.message,{fontSize:'13px',color:C.red}));
    }
  };

  [['saison','🏆 Saison'],['spieler','👤 Spieler'],['team','🤝 Team-Chemie']].forEach(([type,label])=>{
    const b=el('button',{class:'press',style:{padding:'9px 6px',borderRadius:'10px',border:'1px solid '+C.border,background:C.accentBg,color:C.accent,fontSize:'12px',fontWeight:'700',cursor:'pointer'}},label);
    b.onclick=()=>runAnalysis(type,b);
    typeBtns.appendChild(b);
  });

  modal.appendChild(typeBtns);
  modal.appendChild(resultDiv);
  overlay.appendChild(modal);document.body.appendChild(overlay);
};
