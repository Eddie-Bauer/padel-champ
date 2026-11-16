import {C} from '../theme.js';
import {abg,afg,el,div,span,mkAvatar} from '../dom.js';
import {S,getEP} from '../store.js';
import {applyManualTeams} from '../actions.js';
import {drawTeams} from '../logic.js';

// ─── Team Builder Modal ───────────────────────────────────────
export const openTeamBuilder=(eid,rnd)=>{
  const ep=getEP(eid);
  const isOdd=ep.length%2!==0;
  const prevByeId=(S.byeMap[eid]||{})[rnd-1]||null;
  let unassigned=[...ep],formed=[],selP=null,byeP=null;

  const overlay=div('overlay');
  const modal=div('modal-scroll fi');
  overlay.onclick=e=>{if(e.target===overlay)overlay.remove();};

  const hdr=div('',{padding:'18px 18px 12px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid '+C.border,flexShrink:'0'});
  hdr.appendChild(span('Teams — Runde '+rnd,{fontSize:'16px',fontWeight:'700',color:C.text}));
  const hbtns=div('',{display:'flex',gap:'8px'});
  const rndBtn=el('button',{class:'press btn-sm',style:{background:C.accentBg,border:'none',borderRadius:'8px',color:C.accent,fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}},'🔀 Zufällig');
  rndBtn.onclick=()=>{
    const d=drawTeams(ep,prevByeId);
    formed=d.pairs;unassigned=[];byeP=d.bye;selP=null;
    renderTB();
  };
  const xbtn=el('button',{style:{background:C.bg,border:'none',borderRadius:'8px',width:'32px',height:'32px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="'+C.sub+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>');
  xbtn.onclick=()=>overlay.remove();
  hbtns.appendChild(rndBtn);hbtns.appendChild(xbtn);hdr.appendChild(hbtns);modal.appendChild(hdr);

  const body=div('',{flex:'1',overflow:'auto',padding:'14px 18px'});
  modal.appendChild(body);

  const footer=div('',{padding:'10px 18px 0',flexShrink:'0'});
  const cfbtn=el('button',{class:'press',style:{width:'100%',height:'50px',borderRadius:'13px',border:'none',fontSize:'15px',fontWeight:'700',cursor:'pointer'}},'');
  footer.appendChild(cfbtn);modal.appendChild(footer);

  const renderTB=()=>{
    body.innerHTML='';cfbtn.textContent='';
    const canConfirm=formed.length>0&&unassigned.length===0&&(!isOdd||byeP!==null);

    // Unassigned
    if(unassigned.length>0){
      const lbl=isOdd&&unassigned.length===1?'WER HAT PAUSE? (BYE)':selP?'ZWEITEN SPIELER WÄHLEN':'SPIELER ANTIPPEN — ZWEI FÜR EIN TEAM';
      body.appendChild(span(lbl,{fontSize:'11px',fontWeight:'600',color:C.muted,letterSpacing:'.5px',display:'block',marginBottom:'8px'}));
      const pg=div('',{display:'flex',flexWrap:'wrap',gap:'7px',marginBottom:'14px'});
      unassigned.forEach(p=>{
        const pill=document.createElement('button');
        pill.className='press';
        const isSel=selP&&selP.id===p.id;
        const isByeOnly=isOdd&&unassigned.length===1;
        Object.assign(pill.style,{display:'flex',alignItems:'center',gap:'6px',padding:'6px 10px 6px 6px',borderRadius:'20px',border:'2px solid '+(isSel?afg(p.id):C.border),background:isSel?abg(p.id):'transparent',cursor:'pointer'});
        pill.appendChild(mkAvatar(p,24));pill.appendChild(span(p.name.split(' ')[0],{fontSize:'13px',fontWeight:'500',color:isSel?afg(p.id):C.text}));
        pill.onclick=()=>{
          if(isByeOnly){unassigned=unassigned.filter(x=>x.id!==p.id);byeP=p;selP=null;}
          else if(isSel){selP=null;}
          else if(!selP){selP=p;}
          else{formed.push({p1:selP,p2:p});unassigned=unassigned.filter(x=>x.id!==selP.id&&x.id!==p.id);selP=null;}
          renderTB();
        };
        pg.appendChild(pill);
      });
      body.appendChild(pg);
    }

    // Bye banner
    if(byeP){
      const bb=div('',{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px',background:C.orangeBg,border:'1px solid '+C.orange+'30',borderRadius:'12px',padding:'9px 12px'});
      bb.appendChild(span('☕',{fontSize:'16px'}));
      const btxt=div('',{flex:'1'});btxt.appendChild(span(byeP.name.split(' ')[0],{fontWeight:'600',color:C.orange}));btxt.appendChild(span(' hat Pause (Bye)',{color:C.sub,fontSize:'13px'}));
      bb.appendChild(btxt);
      const rmb=el('button',{style:{background:'none',border:'none',cursor:'pointer',padding:'4px'}},'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="'+C.orange+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>');
      rmb.onclick=()=>{unassigned.push(byeP);byeP=null;renderTB();};bb.appendChild(rmb);body.appendChild(bb);
    }

    // Formed teams
    if(formed.length>0){
      body.appendChild(span('TEAMS ('+formed.length+')',{fontSize:'11px',fontWeight:'600',color:C.muted,letterSpacing:'.5px',display:'block',marginBottom:'8px'}));
      formed.forEach((t,i)=>{
        const tr=div('',{display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',background:C.bg,borderRadius:'12px',border:'1px solid '+C.border,marginBottom:'7px'});
        tr.appendChild(span('T'+(i+1),{fontSize:'11px',fontWeight:'700',color:C.muted,minWidth:'20px'}));
        tr.appendChild(mkAvatar(t.p1,26));tr.appendChild(span(t.p1.name.split(' ')[0],{fontSize:'13px',fontWeight:'500',color:C.text}));
        tr.appendChild(span('+',{fontSize:'12px',color:C.muted}));
        tr.appendChild(mkAvatar(t.p2,26));
        const tn=span(t.p2.name.split(' ')[0],{fontSize:'13px',fontWeight:'500',color:C.text});tn.style.flex='1';tr.appendChild(tn);
        const rmb=el('button',{style:{background:C.redBg,border:'none',borderRadius:'7px',width:'28px',height:'28px',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="'+C.red+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>');
        rmb.onclick=()=>{unassigned.push(t.p1,t.p2);formed.splice(i,1);renderTB();};tr.appendChild(rmb);body.appendChild(tr);
      });
    }

    if(formed.length===0&&unassigned.length===0)body.appendChild(span('Tippe „Zufällig" oder wähle Spieler.',{fontSize:'13px',color:C.muted,display:'block',textAlign:'center',padding:'20px 0'}));

    Object.assign(cfbtn.style,{background:canConfirm?C.green:'#E5E7EB',color:canConfirm?'#fff':C.muted,cursor:canConfirm?'pointer':'not-allowed'});
    cfbtn.textContent=canConfirm?'Teams bestätigen':'Noch nicht alle Spieler eingeteilt';
    cfbtn.onclick=canConfirm?()=>{applyManualTeams(eid,rnd,formed,byeP);overlay.remove();}:null;
  };

  renderTB();
  overlay.appendChild(modal);document.body.appendChild(overlay);
};
