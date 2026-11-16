import {C} from '../theme.js';
import {abg,afg,fmtDateShort,el,div,span,mkAvatar,sectionHeader} from '../dom.js';
import {S,getEP,getTeams,getMat,curRnd,matByRnd,teamByRnd,rndDone,getEv,notify,mut,IS_PLAYER,IS_ADMIN} from '../store.js';
import {genTeams,genMatches,deleteMatch,deleteEvent,exportTXT} from '../actions.js';
import {mkMatchCard,openScoreModal} from './match.js';
import {openTeamBuilder} from './teambuilder.js';
import {renderEvents} from './events.js';

// ── Event Detail ──────────────────────────────────────────────
export const renderDetail=()=>{
  const ev=getEv();if(!ev)return renderEvents();
  const ep=getEP(ev.id),cr=curRnd(ev.id);
  const allRnds=[...new Set(getTeams(ev.id).map(t=>t.rnd))].sort((a,b)=>a-b);
  const totM=getMat(ev.id).length,doneM=getMat(ev.id).filter(m=>m.status==='completed').length;
  const locked=ev.status==='completed';
  const SM={planned:{label:'Geplant',color:C.sub,bg:C.bg},active:{label:'Läuft',color:C.green,bg:C.greenBg},completed:{label:'Abgeschlossen',color:C.accent,bg:C.accentBg}};
  const st=SM[ev.status]||SM.planned;
  const RC=['#2563EB','#7C3AED','#EA580C','#16A34A'];
  const rc=rnd=>RC[(rnd-1)%RC.length];
  const s=div('screen fi');

  // Back button + header
  const backBtn=el('button',{class:'press',style:{background:'none',border:'none',color:C.accent,cursor:'pointer',display:'flex',alignItems:'center',gap:'5px',marginBottom:'12px',padding:'0',fontSize:'13px',fontWeight:'600'}},'← Events');
  backBtn.onclick=()=>{S.selEv=null;notify();};
  s.appendChild(div('',{paddingTop:'16px'},backBtn));

  const topRow=div('',{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'14px'});
  const titleDiv=div('');titleDiv.appendChild(span(ev.name,{fontSize:'22px',fontWeight:'700',color:C.text,display:'block'}));titleDiv.appendChild(span(fmtDateShort(ev.date),{fontSize:'13px',color:C.sub,display:'block',marginTop:'2px'}));
  const badgeCol=div('',{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'8px'});
  const badge=div('badge',{background:st.bg});if(ev.status==='active'){const dot=div('',{width:'6px',height:'6px',borderRadius:'3px',background:C.green});badge.appendChild(dot);}badge.appendChild(span(st.label,{color:st.color}));badgeCol.appendChild(badge);
  if(ev.status==='active'){const ab=el('button',{class:'press',style:{fontSize:'12px',fontWeight:'600',color:C.red,background:C.redBg,border:'1px solid '+C.red+'30',borderRadius:'8px',padding:'4px 10px',cursor:'pointer'}},'Event abschliessen ✕');ab.onclick=()=>mut(()=>{ev.status='completed';});badgeCol.appendChild(ab);}
  if(ev.status==='completed'){const tb=el('button',{class:'press',style:{fontSize:'12px',fontWeight:'600',color:C.green,background:C.greenBg,border:'1px solid '+C.green+'30',borderRadius:'8px',padding:'4px 10px',cursor:'pointer'}},'↓ TXT');tb.onclick=()=>exportTXT(ev.id);badgeCol.appendChild(tb);}
  if(IS_ADMIN){const db=el('button',{class:'press',style:{fontSize:'12px',fontWeight:'600',color:C.red,background:'none',border:'1px solid '+C.red+'30',borderRadius:'8px',padding:'4px 10px',cursor:'pointer'}},'Event löschen');db.onclick=()=>deleteEvent(ev.id);badgeCol.appendChild(db);}
  topRow.appendChild(titleDiv);topRow.appendChild(badgeCol);s.appendChild(topRow);

  // Progress bar
  if(totM>0){const prog=div('',{marginBottom:'18px'});const prow=div('',{display:'flex',justifyContent:'space-between',marginBottom:'5px'});prow.appendChild(span('Gesamtfortschritt',{fontSize:'12px',color:C.sub}));prow.appendChild(span(doneM+'/'+totM+' · '+allRnds.length+' '+(allRnds.length===1?'Runde':'Runden'),{fontSize:'12px',fontWeight:'600',color:C.text}));prog.appendChild(prow);const track=div('prog-track');const fill=div('prog-fill');fill.style.width=(totM>0?(doneM/totM*100):0)+'%';track.appendChild(fill);prog.appendChild(track);s.appendChild(prog);}

  // Participants
  s.appendChild(sectionHeader('Teilnehmer ('+ep.length+')'));
  const epcard=div('card',{padding:'12px 14px',marginBottom:'20px'});
  const pills=div('',{display:'flex',flexWrap:'wrap',gap:'7px',marginBottom:'4px'});
  S.players.filter(p=>p.isActive).forEach(p=>{
    const on=ep.some(x=>x.id===p.id),dis=cr>0;
    const pill=document.createElement('button');pill.className='press pill'+(on?' on':'')+(dis?' disabled':'');
    pill.style.setProperty('--abg',abg(p.id));pill.style.setProperty('--afg',afg(p.id));
    if(!dis)pill.onclick=()=>mut(()=>{const has=S.evP.find(ep=>ep.eid===ev.id&&ep.pid===p.id);if(has)S.evP=S.evP.filter(ep=>!(ep.eid===ev.id&&ep.pid===p.id));else S.evP.push({eid:ev.id,pid:p.id});});
    pill.appendChild(mkAvatar(p,20));pill.appendChild(span(p.name.split(' ')[0]));
    pills.appendChild(pill);
  });
  epcard.appendChild(pills);
  if(ep.length<2)epcard.appendChild(span('Mindestens 2 Spieler benötigt.',{fontSize:'12px',color:C.muted,display:'block',marginTop:'4px'}));
  if(cr>0)epcard.appendChild(span('Teilnehmerliste nach Runde 1 gesperrt.',{fontSize:'11px',color:C.muted,display:'block',marginTop:'6px'}));
  s.appendChild(epcard);

  // Round 1 start prompt
  if(cr===0&&ep.length>=2&&!locked){
    const card=div('card fi',{marginBottom:'20px',textAlign:'center',border:'2px dashed '+C.border});
    card.appendChild(span('🎲',{fontSize:'32px',display:'block',marginBottom:'8px'}));
    card.appendChild(span('Bereit zum Starten',{fontSize:'15px',fontWeight:'700',color:C.text,display:'block',marginBottom:'4px'}));
    card.appendChild(span(ep.length+' Spieler · '+(ep.length%2!==0?'1 Bye wird vergeben':'Keine Byes'),{fontSize:'13px',color:C.sub,display:'block',marginBottom:'14px'}));
    const btnrow=div('',{display:'flex',gap:'8px',justifyContent:'center'});
    const rb=el('button',{class:'press btn-primary'},'🔀 Zufällig');rb.onclick=()=>genTeams(ev.id,1);
    const mb=el('button',{class:'press btn-ghost'},'✏️ Manuell');mb.onclick=()=>openTeamBuilder(ev.id,1);
    btnrow.appendChild(rb);btnrow.appendChild(mb);card.appendChild(btnrow);s.appendChild(card);
  }

  // Rounds
  allRnds.forEach(rnd=>{
    const rt=teamByRnd(ev.id,rnd),rm=matByRnd(ev.id,rnd);
    const rdone=rndDone(ev.id,rnd),isAct=rnd===cr;
    const doneCnt=rm.filter(m=>m.status==='completed').length;
    const byeId=(S.byeMap[ev.id]||{})[rnd]||null;
    const byeP=byeId?S.players.find(p=>p.id===byeId):null;
    const color=rc(rnd);

    const rndSec=div('',{marginBottom:'24px'});
    // Round header
    const rh=div('',{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'});
    const rl=div('',{display:'flex',alignItems:'center',gap:'8px'});
    const dot=div('rnd-dot',{background:rdone?C.greenBg:color+'18',border:'2px solid '+(rdone?C.green:color),color:rdone?C.green:color});dot.textContent=rnd;
    rl.appendChild(dot);rl.appendChild(span('Runde '+rnd,{fontSize:'15px',fontWeight:'700',color:C.text}));
    if(rdone)rl.appendChild(span('✅',{fontSize:'14px'}));
    if(!rdone&&isAct&&rm.length>0){const b=div('badge',{background:color+'15'});b.appendChild(span(doneCnt+'/'+rm.length,{color}));rl.appendChild(b);}
    rh.appendChild(rl);
    if(isAct&&rm.length===0&&rt.length>0&&!locked){
      const rbts=div('',{display:'flex',gap:'6px'});
      const zb=el('button',{class:'press',style:{display:'flex',alignItems:'center',gap:'4px',background:C.bg,border:'1px solid '+C.border,borderRadius:'8px',padding:'5px 10px',color:C.sub,fontSize:'12px',fontWeight:'500',cursor:'pointer'}},'🔀 Zufall');zb.onclick=()=>genTeams(ev.id,rnd);
      const mb=el('button',{class:'press',style:{display:'flex',alignItems:'center',gap:'4px',background:C.bg,border:'1px solid '+C.border,borderRadius:'8px',padding:'5px 10px',color:C.sub,fontSize:'12px',fontWeight:'500',cursor:'pointer'}},'✏️ Manuell');mb.onclick=()=>openTeamBuilder(ev.id,rnd);
      rbts.appendChild(zb);rbts.appendChild(mb);rh.appendChild(rbts);
    }
    rndSec.appendChild(rh);

    // Bye banner
    if(byeP){const bb=div('',{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px',background:C.orangeBg,border:'1px solid '+C.orange+'30',borderRadius:'12px',padding:'9px 12px'});bb.appendChild(span('☕',{fontSize:'15px'}));const btxt=div('');btxt.appendChild(span(byeP.name.split(' ')[0],{fontWeight:'600',color:C.orange}));btxt.appendChild(span(' hat Runde '+rnd+' frei (Bye)',{color:C.sub,fontSize:'13px'}));bb.appendChild(btxt);rndSec.appendChild(bb);}

    // Teams grid
    const tgrid=div('',{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'});
    rt.forEach((team,i)=>{
      const p1=S.players.find(p=>p.id===team.player1Id),p2=S.players.find(p=>p.id===team.player2Id);if(!p1||!p2)return;
      const tc=div('teamcard',{borderLeft:'3px solid '+color});
      tc.appendChild(span('TEAM '+(i+1),{fontSize:'10px',fontWeight:'600',color,letterSpacing:'.5px',display:'block',marginBottom:'8px'}));
      [p1,p2].forEach(p=>{const pr=div('',{display:'flex',alignItems:'center',gap:'6px',marginBottom:'5px'});pr.appendChild(mkAvatar(p,22));pr.appendChild(span(p.name.split(' ')[0],{fontSize:'12px',fontWeight:'500',color:C.text}));tc.appendChild(pr);});
      tgrid.appendChild(tc);
    });
    rndSec.appendChild(tgrid);

    // Generate matches button
    if(isAct&&rt.length>=2&&rm.length===0&&!locked){const gb=el('button',{class:'press',style:{width:'100%',padding:'11px',borderRadius:'12px',border:'none',background:C.green,color:'#fff',fontSize:'14px',fontWeight:'600',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',marginBottom:'4px'}},'⚡ Spielplan für Runde '+rnd+' generieren');gb.onclick=()=>genMatches(ev.id,rnd);rndSec.appendChild(gb);}

    // Matches
    rm.forEach(m=>{
      const mc=mkMatchCard(m,isAct&&!locked&&IS_PLAYER?()=>openScoreModal(m):null);if(!mc)return;
      if(!locked&&IS_PLAYER){
        const wrap=div('',{position:'relative'});wrap.appendChild(mc);
        const xb=el('button',{class:'press',title:'Match löschen',style:{position:'absolute',top:'-7px',right:'-7px',width:'22px',height:'22px',borderRadius:'11px',border:'1px solid '+C.red+'55',background:C.redBg,color:C.red,fontSize:'12px',lineHeight:'1',padding:'0',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:'2'}},'✕');
        xb.onclick=(e)=>{e.stopPropagation();deleteMatch(m.id);};
        wrap.appendChild(xb);rndSec.appendChild(wrap);
      } else rndSec.appendChild(mc);
    });

    // Round complete → new round
    if(rdone&&rnd===cr&&!locked){
      const rc2=div('',{background:C.greenBg,border:'1px solid '+C.green+'40',borderRadius:'14px',padding:'16px',marginTop:'8px',textAlign:'center'});
      rc2.appendChild(span('🎉',{fontSize:'28px',display:'block',marginBottom:'6px'}));
      rc2.appendChild(span('Runde '+rnd+' abgeschlossen!',{fontSize:'15px',fontWeight:'700',color:C.green,display:'block',marginBottom:'4px'}));
      rc2.appendChild(span('Alle '+rm.length+' Matches gespielt.',{fontSize:'13px',color:C.sub,display:'block',marginBottom:'14px'}));
      const nb=div('',{display:'flex',gap:'8px',justifyContent:'center'});
      const zb2=el('button',{class:'press',style:{background:C.accent,border:'none',borderRadius:'11px',padding:'11px 18px',color:'#fff',fontSize:'14px',fontWeight:'700',cursor:'pointer'}},'🔀 Zufällig');zb2.onclick=()=>genTeams(ev.id,rnd+1);
      const mb2=el('button',{class:'press',style:{background:C.surface,border:'1.5px solid '+C.accent,borderRadius:'11px',padding:'11px 18px',color:C.accent,fontSize:'14px',fontWeight:'700',cursor:'pointer'}},'✏️ Manuell');mb2.onclick=()=>openTeamBuilder(ev.id,rnd+1);
      nb.appendChild(zb2);nb.appendChild(mb2);rc2.appendChild(nb);rndSec.appendChild(rc2);
    }
    s.appendChild(rndSec);
  });
  return s;
};
