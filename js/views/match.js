import {C} from '../theme.js';
import {abg,afg,el,div,span,mkAvatar} from '../dom.js';
import {S,mut} from '../store.js';
import {calcWinner,checkScore} from '../logic.js';

// ─── Match Card ───────────────────────────────────────────────
export const mkMatchCard=(match,onPress)=>{
  const t1=S.teams.find(t=>t.id===match.team1Id),t2=S.teams.find(t=>t.id===match.team2Id);
  if(!t1||!t2)return null;
  const gp=id=>S.players.find(p=>p.id===id)||{id,name:'?'};
  const done=match.status==='completed',w=match.winnerTeamId;
  const sets=[[match.t1s1,match.t2s1],[match.t1s2,match.t2s2],[match.t1s3,match.t2s3]].filter(([a])=>a!=null);
  const mc=document.createElement('div');mc.className='matchcard press';
  if(onPress)mc.onclick=onPress;
  // Team 1
  const t1div=div('',{flex:'1'});
  const t1avs=div('',{display:'flex',alignItems:'center',gap:'4px',marginBottom:'3px'});
  t1avs.appendChild(mkAvatar(gp(t1.player1Id),22));t1avs.appendChild(mkAvatar(gp(t1.player2Id),22));
  if(done&&w===t1.id)t1avs.appendChild(span('🏆',{fontSize:'12px'}));
  t1div.appendChild(t1avs);t1div.appendChild(span(t1.name,{fontSize:'11px',fontWeight:'500',color:done&&w===t1.id?C.green:C.sub}));
  // Score
  const sdiv=div('',{textAlign:'center',minWidth:'96px',padding:'0 6px'});
  if(done&&!w){
    const np=div('',{background:C.bg,borderRadius:'8px',padding:'4px 10px'});np.appendChild(span('Nicht gespielt',{fontSize:'11px',fontWeight:'600',color:C.muted}));sdiv.appendChild(np);
  } else if(done){
    const sc=document.createElement('span');sc.className='mono';Object.assign(sc.style,{fontSize:'17px',color:C.text,letterSpacing:'1px'});
    sets.forEach(([a,b],i)=>{
      if(i>0){const dot=document.createElement('span');dot.textContent='·';Object.assign(dot.style,{color:C.border,margin:'0 2px'});sc.appendChild(dot);}
      const sa=document.createElement('span');sa.textContent=a;Object.assign(sa.style,{color:a>b?C.text:C.muted,fontWeight:a>b?'700':'400'});
      const col=document.createElement('span');col.textContent=':';Object.assign(col.style,{color:C.border});
      const sb2=document.createElement('span');sb2.textContent=b;Object.assign(sb2.style,{color:b>a?C.text:C.muted,fontWeight:b>a?'700':'400'});
      sc.appendChild(sa);sc.appendChild(col);sc.appendChild(sb2);
    });
    sdiv.appendChild(sc);
  } else {
    const pill=div('',{background:C.accentBg,borderRadius:'8px',padding:'4px 10px'});pill.appendChild(span('Ergebnis →',{fontSize:'11px',fontWeight:'600',color:C.accent}));sdiv.appendChild(pill);
  }
  // Team 2
  const t2div=div('',{flex:'1',display:'flex',flexDirection:'column',alignItems:'flex-end'});
  const t2avs=div('',{display:'flex',alignItems:'center',gap:'4px',marginBottom:'3px',flexDirection:'row-reverse'});
  t2avs.appendChild(mkAvatar(gp(t2.player1Id),22));t2avs.appendChild(mkAvatar(gp(t2.player2Id),22));
  if(done&&w===t2.id)t2avs.appendChild(span('🏆',{fontSize:'12px'}));
  t2div.appendChild(t2avs);t2div.appendChild(span(t2.name,{fontSize:'11px',fontWeight:'500',textAlign:'right',color:done&&w===t2.id?C.green:C.sub}));
  mc.appendChild(t1div);mc.appendChild(sdiv);mc.appendChild(t2div);
  return mc;
};

// ─── Score Modal ──────────────────────────────────────────────
let scoreModalOpen=false;
export const openScoreModal=(match)=>{
  if(scoreModalOpen)return;scoreModalOpen=true;
  const t1=S.teams.find(t=>t.id===match.team1Id),t2=S.teams.find(t=>t.id===match.team2Id);
  const gp=id=>S.players.find(p=>p.id===id)||{id,name:'?'};
  const c1bg=t1?abg(t1.player1Id):'#DBEAFE',c1fg=t1?afg(t1.player1Id):'#1D4ED8';
  const c2bg=t2?abg(t2.player1Id):'#D1FAE5',c2fg=t2?afg(t2.player1Id):'#065F46';
  const sets=[{t1:match.t1s1??0,t2:match.t2s1??0}];
  if(match.t1s2!=null)sets.push({t1:match.t1s2,t2:match.t2s2??0});
  if(match.t1s3!=null)sets.push({t1:match.t1s3,t2:match.t2s3??0});

  const overlay=div('overlay');
  const modal=div('modal fi');
  overlay.onclick=e=>{if(e.target===overlay)close();};
  const close=()=>{overlay.remove();scoreModalOpen=false;};

  // Header
  const hdr=div('',{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'});
  hdr.appendChild(span('Ergebnis eintragen',{fontSize:'17px',fontWeight:'700',color:C.text}));
  const xbtn=el('button',{style:{background:C.bg,border:'none',borderRadius:'8px',width:'32px',height:'32px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="'+C.sub+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>');
  xbtn.onclick=close;hdr.appendChild(xbtn);modal.appendChild(hdr);

  // Teams header
  if(t1&&t2){
    const th=div('',{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'});
    const t1h=div('');const t1avs=div('',{display:'flex',gap:'4px',marginBottom:'4px'});t1avs.appendChild(mkAvatar(gp(t1.player1Id),26));t1avs.appendChild(mkAvatar(gp(t1.player2Id),26));t1h.appendChild(t1avs);t1h.appendChild(span(t1.name,{fontSize:'12px',fontWeight:'600',color:c1fg}));
    const vspill=div('',{background:C.bg,borderRadius:'8px',padding:'4px 10px'});vspill.appendChild(span('VS',{fontSize:'12px',fontWeight:'600',color:C.muted}));
    const t2h=div('',{textAlign:'right'});const t2avs=div('',{display:'flex',gap:'4px',marginBottom:'4px',justifyContent:'flex-end'});t2avs.appendChild(mkAvatar(gp(t2.player1Id),26));t2avs.appendChild(mkAvatar(gp(t2.player2Id),26));t2h.appendChild(t2avs);t2h.appendChild(span(t2.name,{fontSize:'12px',fontWeight:'600',color:c2fg}));
    th.appendChild(t1h);th.appendChild(vspill);th.appendChild(t2h);modal.appendChild(th);
  }

  // Sets container
  const setsContainer=div('');
  const SL=['Satz 1','Satz 2','Satz 3 (Super-TB)'];
  const renderSets=()=>{
    setsContainer.innerHTML='';
    sets.forEach((s,si)=>{
      const sw=div('',{marginBottom:'18px'});
      const slabel=div('',{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'});
      slabel.appendChild(span(SL[si],{fontSize:'13px',fontWeight:'600',color:C.sub}));
      if(si>0&&si===sets.length-1){const rm=el('button',{class:'press',style:{fontSize:'12px',color:C.red,background:'none',border:'none',cursor:'pointer',fontWeight:'500'}},'Entfernen');rm.onclick=()=>{sets.splice(si,1);renderSets();};slabel.appendChild(rm);}
      sw.appendChild(slabel);
      const row=div('',{display:'flex',alignItems:'center',justifyContent:'space-between'});
      const mkSide=(team,color,bg)=>{
        const sd=div('',{display:'flex',alignItems:'center',gap:'10px'});
        const minusBtn=document.createElement('button');minusBtn.className='stepbtn sbtn';minusBtn.textContent='−';Object.assign(minusBtn.style,{background:s[team]===0?C.divider:bg,color:s[team]===0?C.muted:color});
        minusBtn.disabled=s[team]===0;minusBtn.onclick=()=>{if(s[team]>0){s[team]--;renderSets();}};
        const num=document.createElement('span');num.className='mono';num.textContent=s[team];Object.assign(num.style,{fontSize:'52px',fontWeight:'500',color:C.text,minWidth:'44px',textAlign:'center',lineHeight:'1'});
        const plusBtn=document.createElement('button');plusBtn.className='stepbtn sbtn';plusBtn.textContent='+';Object.assign(plusBtn.style,{background:s[team]===7?C.divider:bg,color:s[team]===7?C.muted:color});
        plusBtn.disabled=s[team]===7;plusBtn.onclick=()=>{if(s[team]<7){s[team]++;renderSets();}};
        sd.appendChild(minusBtn);sd.appendChild(num);sd.appendChild(plusBtn);return sd;
      };
      row.appendChild(mkSide('t1',c1fg,c1bg));
      row.appendChild(span(':',{fontSize:'22px',color:C.border}));
      row.appendChild(mkSide('t2',c2fg,c2bg));
      sw.appendChild(row);
      if(si<sets.length-1){const hr=document.createElement('hr');hr.style.marginTop='16px';sw.appendChild(hr);}
      setsContainer.appendChild(sw);
    });
    // Add set button
    if(sets.length<3){
      const ab=el('button',{class:'press',style:{width:'100%',padding:'11px',borderRadius:'12px',border:'2px dashed '+C.border,background:C.bg,color:C.sub,fontSize:'13px',fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',marginBottom:'14px'}},'+ Satz hinzufügen');
      ab.onclick=()=>{sets.push({t1:0,t2:0});renderSets();};setsContainer.appendChild(ab);
    }
    // Save button
    const sv=el('button',{class:'press',style:{width:'100%',height:'52px',borderRadius:'14px',border:'none',background:C.accent,color:'#fff',fontSize:'16px',fontWeight:'700',cursor:'pointer'}},'Speichern');
    sv.onclick=()=>{
      const chk=checkScore(sets);
      if(!chk.ok){alert('⚠️ '+chk.error);return;}
      if(chk.notPlayed)sets.splice(1);
      mut(()=>{
        const m=S.matches.find(x=>x.id===match.id);if(!m)return;
        m.t1s1=sets[0]?.t1??null;m.t2s1=sets[0]?.t2??null;
        m.t1s2=sets[1]?.t1??null;m.t2s2=sets[1]?.t2??null;
        m.t1s3=sets[2]?.t1??null;m.t2s3=sets[2]?.t2??null;
        m.status='completed';m.winnerTeamId=calcWinner(m);
      });close();
    };
    setsContainer.appendChild(sv);
  };
  renderSets();modal.appendChild(setsContainer);
  overlay.appendChild(modal);document.body.appendChild(overlay);
};
