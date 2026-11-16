import {C} from '../theme.js';
import {fmtDateShort,el,div,span} from '../dom.js';
import {uid,S,activeSeason,getMat,curRnd,notify,mut} from '../store.js';

// ── Events ────────────────────────────────────────────────────
export const renderEvents=()=>{
  const s=div('screen fi');
  const as=activeSeason();
  const top=div('',{paddingTop:'24px',paddingBottom:'18px',display:'flex',justifyContent:'space-between',alignItems:'flex-end'});
  const tl=div('');tl.appendChild(span(as.name,{fontSize:'12px',fontWeight:'600',color:C.muted,letterSpacing:'.5px',display:'block',marginBottom:'4px'}));tl.appendChild(span('Events 📅',{fontSize:'28px',fontWeight:'800',color:C.text,display:'block'}));top.appendChild(tl);
  const newBtn=el('button',{id:'new-ev-btn',class:'press btn-primary btn-sm'},'+ Neu');
  let showForm=false;
  const toggleForm=()=>{showForm=!showForm;form.style.display=showForm?'block':'none';};
  newBtn.onclick=toggleForm;top.appendChild(newBtn);s.appendChild(top);
  // New event form
  const form=div('card fi',{marginBottom:'14px',display:'none'});
  form.appendChild(span('Neuer Padel Day',{fontSize:'13px',fontWeight:'600',color:C.text,display:'block',marginBottom:'12px'}));
  const dateInput=el('input',{type:'date'});dateInput.style.marginBottom='10px';form.appendChild(dateInput);
  const fbrow=div('',{display:'flex',gap:'8px'});
  const cancelBtn=el('button',{class:'press',style:{flex:'1',padding:'10px',borderRadius:'10px',border:'1px solid '+C.border,background:C.bg,color:C.sub,cursor:'pointer',fontSize:'13px',fontWeight:'500'}},'Abbrechen');cancelBtn.onclick=toggleForm;
  const createBtn=el('button',{class:'press',style:{flex:'2',padding:'10px',borderRadius:'10px',border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontSize:'13px',fontWeight:'600'}},'Erstellen');
  createBtn.onclick=()=>{
    if(!dateInput.value)return;
    const d=dateInput.value;
    const fmtD=new Date(d+'T12:00:00').toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit',year:'numeric'});
    mut(()=>S.events.push({id:uid(),sid:as.id,name:'Padel Day '+fmtD,date:d,status:'planned'}));
    S.selEv=S.events[S.events.length-1].id;notify();
  };
  fbrow.appendChild(cancelBtn);fbrow.appendChild(createBtn);form.appendChild(fbrow);s.appendChild(form);
  const evs=S.events.filter(e=>e.sid===as.id).sort((a,b)=>b.date.localeCompare(a.date));
  if(evs.length===0){const em=div('',{textAlign:'center',paddingTop:'40px'});em.appendChild(span('📅',{fontSize:'40px',display:'block',marginBottom:'10px',opacity:'.3'}));em.appendChild(span('Noch keine Events in '+as.name+'.',{fontSize:'14px',color:C.muted}));s.appendChild(em);return s;}
  evs.forEach(ev=>{
    const am=getMat(ev.id),dm=am.filter(m=>m.status==='completed').length,rnd=curRnd(ev.id);
    const ac={planned:C.sub,active:C.green,completed:C.accent}[ev.status]||C.sub;
    const ec=div('evcard');ec.onclick=()=>{S.selEv=ev.id;notify();};
    const bar=div('evcard-bar');bar.style.background=ac;ec.appendChild(bar);
    const body=div('evcard-body');const info=div('');
    info.appendChild(span(ev.name,{fontSize:'15px',fontWeight:'700',color:C.text,display:'block'}));
    const sub2=span(fmtDateShort(ev.date),{fontSize:'12px',color:C.muted});if(rnd>0){sub2.textContent+=' · Runde '+rnd;}info.appendChild(sub2);
    body.appendChild(info);
    const right=div('',{display:'flex',alignItems:'center',gap:'10px'});
    if(am.length>0){const mc=div('',{textAlign:'right'});mc.appendChild(span(dm+'/'+am.length,{fontSize:'16px',fontWeight:'600',color:ac,fontFamily:'DM Mono,monospace',display:'block'}));mc.appendChild(span('Matches',{fontSize:'10px',color:C.muted}));right.appendChild(mc);}
    right.appendChild(span('›',{fontSize:'20px',color:C.border}));body.appendChild(right);ec.appendChild(body);s.appendChild(ec);
  });
  return s;
};
