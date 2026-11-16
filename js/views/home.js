import {C} from '../theme.js';
import {fmtDate,el,div,span,mkAvatar,sectionHeader} from '../dom.js';
import {S,activeSeason,getMat,curRnd,matByRnd,standings,notify,IS_PLAYER} from '../store.js';
import {mkMatchCard,openScoreModal} from './match.js';

// ── Home ──────────────────────────────────────────────────────
export const renderHome=()=>{
  const s=div('screen fi');
  const as=activeSeason();
  s.appendChild(div('',{paddingTop:'24px',paddingBottom:'18px'},[
    span(as.name,{fontSize:'12px',fontWeight:'600',color:C.muted,letterSpacing:'.5px',display:'block',marginBottom:'4px'}),
    span('Padel Champ 🏆',{fontSize:'30px',fontWeight:'800',color:C.text,display:'block',lineHeight:'1.1'})
  ]));
  const evs=S.events.filter(e=>e.sid===as.id).sort((a,b)=>b.date.localeCompare(a.date));
  const latest=evs[0];
  if(!latest){
    const empty=div('',{textAlign:'center',paddingTop:'40px'});empty.appendChild(span('🎾',{fontSize:'52px',display:'block',marginBottom:'14px'}));empty.appendChild(span('Noch kein Event',{fontSize:'15px',fontWeight:'500',color:C.sub,display:'block',marginBottom:'6px'}));empty.appendChild(span('Erstelle deinen ersten Padel Day.',{fontSize:'13px',color:C.muted,display:'block',marginBottom:'24px'}));
    const nb=el('button',{class:'press btn-primary',style:{margin:'0 auto',display:'flex'}},'+ Neues Event');nb.onclick=()=>{S.tab=2;notify();setTimeout(()=>document.getElementById('new-ev-btn')?.click(),100);};empty.appendChild(nb);s.appendChild(empty);return s;
  }
  // Latest event card
  const lc=div('card',{marginBottom:'16px',padding:'0',overflow:'hidden'});
  const lch=div('',{background:latest.status==='active'?C.greenBg:latest.status==='completed'?C.accentBg:C.bg,padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid '+C.border});
  lch.appendChild(span(latest.status==='active'?'● Live':latest.status==='completed'?'✓ Abgeschlossen':'○ Geplant',{fontSize:'12px',fontWeight:'600',color:latest.status==='active'?C.green:latest.status==='completed'?C.accent:C.sub}));
  lch.appendChild(span(fmtDate(latest.date,{day:'numeric',month:'short'}),{fontSize:'12px',color:C.muted}));lc.appendChild(lch);
  const lcb=div('',{padding:'14px 14px 10px'});
  lcb.appendChild(span(latest.name,{fontSize:'17px',fontWeight:'700',color:C.text,display:'block',marginBottom:'10px'}));
  const cr=curRnd(latest.id);
  matByRnd(latest.id,cr).slice(0,3).forEach(m=>{const mc=mkMatchCard(m,IS_PLAYER?()=>{S.selEv=latest.id;S.tab=2;notify();setTimeout(()=>openScoreModal(m),100);}:null);if(mc)lcb.appendChild(mc);});
  if(getMat(latest.id).length===0)lcb.appendChild(span('Noch kein Spielplan.',{fontSize:'13px',color:C.muted,display:'block'}));
  const ob=el('button',{class:'press',style:{width:'100%',marginTop:'10px',padding:'9px',borderRadius:'9px',border:'1px solid '+C.border,background:C.bg,color:C.accent,fontSize:'13px',fontWeight:'600',cursor:'pointer'}},'Vollständig öffnen →');ob.onclick=()=>{S.selEv=latest.id;S.tab=2;notify();};lcb.appendChild(ob);lc.appendChild(lcb);s.appendChild(lc);
  // Top 3
  const st=standings();
  if(st.length>0){
    s.appendChild(sectionHeader('Saison-Leader'));
    const card=div('card');
    st.slice(0,3).forEach((x,i)=>{const row=div('',{display:'flex',alignItems:'center',gap:'10px',padding:'9px 0',borderBottom:i<2?'1px solid '+C.divider:'none'});row.appendChild(span(['🥇','🥈','🥉'][i],{fontSize:'18px',width:'24px',display:'block'}));row.appendChild(mkAvatar(x.player,32));const inf=div('',{flex:'1'});inf.appendChild(span(x.player.name,{fontSize:'14px',fontWeight:'600',color:C.text,display:'block'}));inf.appendChild(span(x.w+'S '+x.l+'N · Satzdiff '+(x.sd>0?'+':'')+x.sd,{fontSize:'11px',color:C.muted,display:'block'}));row.appendChild(inf);row.appendChild(span(String(x.pts),{fontSize:'22px',fontWeight:'600',color:C.text,fontFamily:'DM Mono,monospace'}));row.appendChild(span('Pkt',{fontSize:'11px',color:C.muted}));card.appendChild(row);});
    s.appendChild(card);
  }
  return s;
};
