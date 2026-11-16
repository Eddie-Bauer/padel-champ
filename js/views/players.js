import {C} from '../theme.js';
import {el,div,span,mkAvatar} from '../dom.js';
import {uid,S,standings,mut} from '../store.js';

// ── Spieler ───────────────────────────────────────────────────
export const renderPlayers=()=>{
  const s=div('screen fi');
  const top=div('',{paddingTop:'24px',paddingBottom:'18px',display:'flex',justifyContent:'space-between',alignItems:'flex-end'});
  top.appendChild(span('Spieler 👥',{fontSize:'28px',fontWeight:'800',color:C.text,display:'block'}));
  const nb=el('button',{class:'press btn-primary btn-sm viewer-hidden'},'+ Neu');let showForm=false;
  const form=div('card fi',{marginBottom:'14px',display:'none'});
  form.appendChild(span('Neuer Spieler',{fontSize:'13px',fontWeight:'600',color:C.text,display:'block',marginBottom:'10px'}));
  const ni=el('input',{type:'text',placeholder:'Name eingeben...'});ni.style.marginBottom='10px';form.appendChild(ni);
  const fbrow=div('',{display:'flex',gap:'8px'});
  const canBtn=el('button',{class:'press',style:{flex:'1',padding:'10px',borderRadius:'10px',border:'1px solid '+C.border,background:C.bg,color:C.sub,cursor:'pointer',fontSize:'13px',fontWeight:'500'}},'Abbrechen');canBtn.onclick=()=>{showForm=false;form.style.display='none';};
  const addBtn=el('button',{class:'press',style:{flex:'2',padding:'10px',borderRadius:'10px',border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontSize:'13px',fontWeight:'600'}},'Hinzufügen');
  addBtn.onclick=()=>{if(!ni.value.trim())return;mut(()=>S.players.push({id:uid(),name:ni.value.trim(),isActive:true}));};
  ni.onkeydown=e=>{if(e.key==='Enter')addBtn.click();};
  fbrow.appendChild(canBtn);fbrow.appendChild(addBtn);form.appendChild(fbrow);
  nb.onclick=()=>{showForm=!showForm;form.style.display=showForm?'block':'none';if(showForm)setTimeout(()=>ni.focus(),50);};
  top.appendChild(nb);s.appendChild(top);s.appendChild(form);
  const st=standings();
  S.players.filter(p=>p.isActive).forEach((p,i)=>{
    const x=st.find(x=>x.player.id===p.id);
    const card=div('card',{marginBottom:'8px',padding:'12px 14px'});
    const row=div('',{display:'flex',alignItems:'center',gap:'12px'});row.appendChild(mkAvatar(p,42));
    const inf=div('',{flex:'1'});inf.appendChild(span(p.name,{fontSize:'15px',fontWeight:'600',color:C.text,display:'block'}));inf.appendChild(span(x?x.pts+' Pkt · Rang '+x.rank+' · '+x.w+'S '+x.l+'N':'Noch keine Spiele',{fontSize:'12px',color:C.muted,display:'block',marginTop:'1px'}));row.appendChild(inf);
    if(x&&x.rank===1)row.appendChild(span('🏆',{fontSize:'20px'}));
    const delBtn=el('button',{class:'press',style:{background:C.redBg,border:'1px solid '+C.red+'30',borderRadius:'8px',width:'32px',height:'32px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:'0'}},'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+C.red+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>');
    delBtn.onclick=()=>{if(confirm(p.name+' wirklich löschen?'))mut(()=>S.players=S.players.filter(x=>x.id!==p.id));};
    row.appendChild(delBtn);card.appendChild(row);s.appendChild(card);
  });
  return s;
};
