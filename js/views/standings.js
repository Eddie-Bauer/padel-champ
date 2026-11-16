import {C} from '../theme.js';
import {el,div,span,mkAvatar} from '../dom.js';
import {S,activeSeason,displaySeason,standings,notify} from '../store.js';
import {exportCSV} from '../actions.js';
import {openKiAnalyse} from './ki.js';

// ── Rangliste ─────────────────────────────────────────────────
export const renderStandings=()=>{
  const s=div('screen fi');
  const ds=displaySeason();
  const top=div('',{paddingTop:'24px',paddingBottom:'12px',display:'flex',justifyContent:'space-between',alignItems:'flex-end'});
  const tl=div('');tl.appendChild(span(ds.name,{fontSize:'12px',fontWeight:'600',color:C.muted,letterSpacing:'.5px',display:'block',marginBottom:'4px'}));tl.appendChild(span('Rangliste 🏆',{fontSize:'28px',fontWeight:'800',color:C.text,display:'block'}));top.appendChild(tl);
  const topBtns=div('',{display:'flex',gap:'8px',alignItems:'center'});
  const kiBtn=el('button',{class:'press',style:{display:'flex',alignItems:'center',gap:'6px',background:'#F5F3FF',border:'1px solid #7C3AED40',borderRadius:'10px',padding:'8px 14px',color:'#7C3AED',fontSize:'13px',fontWeight:'600',cursor:'pointer'}},'🤖 KI');kiBtn.onclick=openKiAnalyse;topBtns.appendChild(kiBtn);
  const csvBtn=el('button',{class:'press',style:{display:'flex',alignItems:'center',gap:'6px',background:C.greenBg,border:'1px solid '+C.green+'40',borderRadius:'10px',padding:'8px 14px',color:C.green,fontSize:'13px',fontWeight:'600',cursor:'pointer'}},'↓ CSV');csvBtn.onclick=exportCSV;topBtns.appendChild(csvBtn);top.appendChild(topBtns);s.appendChild(top);
  // Season picker
  if(S.seasons.length>1){const sp=div('',{display:'flex',gap:'7px',marginBottom:'14px',flexWrap:'wrap'});S.seasons.forEach(ss=>{const sel=ds.id===ss.id;const b=el('button',{class:'press',style:{padding:'5px 12px',borderRadius:'20px',border:'1.5px solid '+(sel?C.accent:C.border),background:sel?C.accentBg:'transparent',color:sel?C.accent:C.sub,fontSize:'12px',fontWeight:'600',cursor:'pointer'}},ss.name+(ss.isActive?' ✦':''));b.onclick=()=>{S.selSeason=ss.id===activeSeason().id?null:ss.id;notify();};sp.appendChild(b);});s.appendChild(sp);}
  const st=standings();
  if(st.length===0){const c=div('card',{textAlign:'center',padding:'24px 0'});c.appendChild(span('🏆',{fontSize:'40px',display:'block',marginBottom:'10px',opacity:'.2'}));c.appendChild(span('Noch keine Ergebnisse.',{fontSize:'14px',color:C.muted}));s.appendChild(c);return s;}
  // Header
  const gh=div('sg sg-hdr');['','Spieler','Sp','S','N','S%','Pkt'].forEach((h,i)=>{const hc=span(h,{fontSize:'11px',fontWeight:'600',color:C.muted});hc.style.textAlign=i>1?'center':'left';gh.appendChild(hc);});s.appendChild(gh);
  const card=div('card',{padding:'4px 12px'});
  st.forEach((x,i)=>{
    const row=div('sg sg-row');row.style.borderBottom=i<st.length-1?'1px solid '+C.divider:'none';
    const rank=span(i<3?['🥇','🥈','🥉'][i]:String(x.rank),{fontSize:i<3?'20px':'14px',textAlign:'center',display:'block'});row.appendChild(rank);
    const nameCell=div('',{display:'flex',alignItems:'center',gap:'8px'});nameCell.appendChild(mkAvatar(x.player,30));const ni=div('');ni.appendChild(span(x.player.name,{fontSize:'13px',fontWeight:'600',color:C.text,display:'block'}));ni.appendChild(span('Satz '+(x.sd>0?'+':'')+x.sd+' · Game '+(x.gd>0?'+':'')+x.gd,{fontSize:'10px',color:C.muted,display:'block'}));nameCell.appendChild(ni);row.appendChild(nameCell);
    [x.mp,x.w,x.l].forEach(v=>{const c2=span(String(v),{textAlign:'center',display:'block',fontFamily:'DM Mono,monospace',fontSize:'14px',color:C.sub});row.appendChild(c2);});
    const pct=span(x.pct+'%',{textAlign:'center',display:'block',fontFamily:'DM Mono,monospace',fontSize:'13px',fontWeight:'600',color:x.pct>=60?C.green:x.pct>=40?C.sub:C.red});row.appendChild(pct);
    const pts=span(String(x.pts),{textAlign:'center',display:'block',fontFamily:'DM Mono,monospace',fontSize:'20px',fontWeight:'600',color:i<3?C.accent:C.text});row.appendChild(pts);
    card.appendChild(row);
  });
  s.appendChild(card);
  s.appendChild(span('Sp = Spiele · S = Siege · N = Niederlagen · S% = Siegquote · Pkt = Punkte (S×'+S.settings.ptsWin+')',{fontSize:'11px',color:C.muted,display:'block',textAlign:'center',marginTop:'12px'}));
  return s;
};
