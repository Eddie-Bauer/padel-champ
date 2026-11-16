import {C,setTheme} from '../theme.js';
import {el,div,span} from '../dom.js';
import {uid,IS_ADMIN,S,mut} from '../store.js';

// ── Settings ──────────────────────────────────────────────────
export const renderSettings=()=>{
  const s=div('screen fi');s.appendChild(span('Einstellungen ⚙️',{fontSize:'28px',fontWeight:'800',color:C.text,display:'block',paddingTop:'24px',paddingBottom:'18px'}));
  // Theme
  const curTheme=localStorage.getItem('pc_theme')||'light';
  const tc=div('card',{marginBottom:'16px'});
  tc.appendChild(span('Design',{fontSize:'14px',fontWeight:'700',color:C.text,display:'block',marginBottom:'4px'}));
  tc.appendChild(span('Hell oder Dunkel — wie du magst.',{fontSize:'13px',color:C.muted,display:'block',marginBottom:'14px'}));
  const trow=div('',{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'});
  const mkThemeBtn=(key,icon,label,desc)=>{
    const sel=curTheme===key;
    const b=el('button',{class:'press',style:{padding:'14px 12px',borderRadius:'14px',border:'2px solid '+(sel?C.accent:C.border),background:sel?C.accentBg:C.bg,cursor:'pointer',textAlign:'left',display:'flex',flexDirection:'column',gap:'4px'}});
    b.appendChild(span(icon,{fontSize:'24px',display:'block'}));
    b.appendChild(span(label,{fontSize:'13px',fontWeight:'700',color:sel?C.accent:C.text,display:'block'}));
    b.appendChild(span(desc,{fontSize:'11px',color:C.muted,display:'block'}));
    if(sel){const dot=div('',{width:'8px',height:'8px',borderRadius:'4px',background:C.accent,alignSelf:'flex-end',marginTop:'2px'});b.appendChild(dot);}
    b.onclick=()=>{if(curTheme!==key)setTheme(key);};
    return b;
  };
  trow.appendChild(mkThemeBtn('light','☀️','Hell','Weiss & klar'));
  trow.appendChild(mkThemeBtn('dark','🌙','Dunkel','Schont die Augen'));
  tc.appendChild(trow);if(IS_ADMIN)s.appendChild(tc);
  // Points system
  const pc=div('card',{marginBottom:'16px'});
  pc.appendChild(span('Punktesystem',{fontSize:'14px',fontWeight:'700',color:C.text,display:'block',marginBottom:'4px'}));
  pc.appendChild(span('Wieviele Punkte gibt es pro Sieg bzw. Niederlage?',{fontSize:'13px',color:C.muted,display:'block',marginBottom:'18px'}));
  const mkStepper=(label,key,min,max)=>{
    const w=div('',{marginBottom:'14px'});w.appendChild(span(label,{fontSize:'12px',fontWeight:'600',color:C.sub,display:'block',marginBottom:'8px'}));
    const row=div('',{display:'flex',alignItems:'center',gap:'12px'});
    const minusBtn=el('button',{class:'press sbtn',style:{width:'44px',height:'44px',borderRadius:'22px',border:'1px solid '+C.border,background:C.bg,color:C.text,fontSize:'22px',fontWeight:'700',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'−');
    const num=span(String(S.settings[key]),{fontSize:'36px',fontWeight:'800',color:key==='ptsWin'?C.accent:C.sub,minWidth:'48px',textAlign:'center',display:'block',fontFamily:'DM Mono,monospace'});
    const plusBtn=el('button',{class:'press sbtn',style:{width:'44px',height:'44px',borderRadius:'22px',border:'1px solid '+C.border,background:C.bg,color:C.text,fontSize:'22px',fontWeight:'700',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}},'+');
    minusBtn.onclick=()=>{if(S.settings[key]>min){mut(()=>S.settings[key]--);num.textContent=String(S.settings[key]);}};
    plusBtn.onclick=()=>{if(S.settings[key]<max){mut(()=>S.settings[key]++);num.textContent=String(S.settings[key]);}};
    row.appendChild(minusBtn);row.appendChild(num);row.appendChild(plusBtn);row.appendChild(span('Punkte',{fontSize:'13px',color:C.muted}));w.appendChild(row);return w;
  };
  pc.appendChild(mkStepper('PUNKTE PRO SIEG','ptsWin',1,10));const hr=document.createElement('hr');hr.style.margin='4px 0 14px';pc.appendChild(hr);pc.appendChild(mkStepper('PUNKTE PRO NIEDERLAGE','ptsLoss',0,9));
  const info=div('',{marginTop:'18px',background:C.accentBg,borderRadius:'12px',padding:'12px 14px'});info.appendChild(span('Aktuelles System',{fontSize:'12px',fontWeight:'600',color:C.accent,display:'block',marginBottom:'4px'}));info.appendChild(span('Sieg = '+S.settings.ptsWin+' Pkt · Niederlage = '+S.settings.ptsLoss+' Pkt',{fontSize:'13px',color:C.text}));pc.appendChild(info);if(IS_ADMIN)s.appendChild(pc);

  // Seasons
  const sc=div('card',{marginBottom:'16px'});
  const sch=div('',{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'});
  sch.appendChild(span('Saisons',{fontSize:'14px',fontWeight:'700',color:C.text}));
  let showNewSeason=false;
  const newSBtn=el('button',{class:'press viewer-hidden',style:{background:C.accentBg,border:'none',borderRadius:'8px',padding:'5px 12px',color:C.accent,fontSize:'12px',fontWeight:'600',cursor:'pointer'}},'+ Neue Saison');
  sch.appendChild(newSBtn);sc.appendChild(sch);
  sc.appendChild(span('Saison anlegen und aktivieren',{fontSize:'13px',color:C.muted,display:'block',marginBottom:'14px'}));
  const nsForm=div('',{background:C.bg,borderRadius:'12px',padding:'12px',marginBottom:'14px',border:'1px solid '+C.border,display:'none'});
  nsForm.appendChild(span('NAME DER SAISON',{fontSize:'12px',fontWeight:'600',color:C.sub,display:'block',marginBottom:'8px'}));
  const nsName=el('input',{type:'text',placeholder:'z.B. Q3 2025 oder Sommer 2025'});nsName.style.marginBottom='10px';nsForm.appendChild(nsName);
  const nsGrid=div('',{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'});
  const nsStart=el('input',{type:'date'});const nsEnd=el('input',{type:'date'});
  const mkDL=(lbl,inp)=>{const d=div('');d.appendChild(span(lbl,{fontSize:'12px',fontWeight:'600',color:C.sub,display:'block',marginBottom:'6px'}));d.appendChild(inp);return d;};
  nsGrid.appendChild(mkDL('START',nsStart));nsGrid.appendChild(mkDL('ENDE',nsEnd));nsForm.appendChild(nsGrid);
  const nsCreate=el('button',{class:'press',style:{width:'100%',padding:'10px',borderRadius:'10px',border:'none',background:C.accent,color:'#fff',cursor:'pointer',fontSize:'13px',fontWeight:'600'}},'Saison anlegen');
  nsCreate.onclick=()=>{if(!nsName.value.trim()||!nsStart.value||!nsEnd.value)return;mut(()=>S.seasons.push({id:uid(),name:nsName.value.trim(),startDate:nsStart.value,endDate:nsEnd.value,isActive:false}));nsName.value='';nsStart.value='';nsEnd.value='';showNewSeason=false;nsForm.style.display='none';};
  nsForm.appendChild(nsCreate);sc.appendChild(nsForm);
  newSBtn.onclick=()=>{showNewSeason=!showNewSeason;nsForm.style.display=showNewSeason?'block':'none';};
  // Season list
  const slc=div('',{display:'flex',flexDirection:'column',gap:'8px'});
  S.seasons.forEach(ss=>{
    const evCount=S.events.filter(e=>e.sid===ss.id).length;
    const mCount=S.matches.filter(m=>m.status==='completed'&&S.events.find(e=>e.id===m.eid&&e.sid===ss.id)).length;
    const sr=div('',{display:'flex',alignItems:'center',gap:'10px',background:ss.isActive?C.greenBg:C.bg,borderRadius:'12px',padding:'10px 12px',border:'1px solid '+(ss.isActive?C.green+'40':C.border)});
    const si=div('',{flex:'1'});
    const snh=div('',{display:'flex',alignItems:'center',gap:'6px'});snh.appendChild(span(ss.name,{fontSize:'14px',fontWeight:'700',color:ss.isActive?C.green:C.text}));if(ss.isActive){const ab=div('badge',{background:C.greenBg,border:'1px solid '+C.green+'40'});ab.appendChild(span('AKTIV',{color:C.green,fontSize:'10px',fontWeight:'700'}));snh.appendChild(ab);}
    si.appendChild(snh);si.appendChild(span((ss.startDate?ss.startDate+' – '+ss.endDate:'')+(evCount>0?' · '+evCount+' Events':'')+(mCount>0?' · '+mCount+' Matches':''),{fontSize:'11px',color:C.sub,display:'block',marginTop:'2px'}));
    sr.appendChild(si);
    if(!ss.isActive&&IS_ADMIN){const ab=el('button',{class:'press',style:{background:C.accent,border:'none',borderRadius:'8px',padding:'6px 12px',color:'#fff',fontSize:'12px',fontWeight:'600',cursor:'pointer'}},'Aktivieren');ab.onclick=()=>mut(()=>S.seasons.forEach(x=>x.isActive=x.id===ss.id));sr.appendChild(ab);}
    slc.appendChild(sr);
  });
  sc.appendChild(slc);if(IS_ADMIN)s.appendChild(sc);

  // Reset
  const rc=div('card',{marginTop:'16px',border:'1px solid '+C.red+'30'});
  rc.appendChild(span('Daten zurücksetzen',{fontSize:'14px',fontWeight:'700',color:C.text,display:'block',marginBottom:'4px'}));
  rc.appendChild(span('Spieldaten löschen lässt Spieler erhalten. «Alles löschen» setzt die App komplett zurück.',{fontSize:'13px',color:C.muted,display:'block',marginBottom:'14px'}));
  const db1=el('button',{class:'press btn-red',style:{width:'100%',padding:'11px',borderRadius:'12px',fontSize:'14px',fontWeight:'600',cursor:'pointer',marginBottom:'8px'}},'Spieldaten löschen');
  db1.onclick=()=>{if(confirm('Alle Spieldaten löschen? Spieler bleiben erhalten.'))mut(()=>{S.events=[];S.evP=[];S.teams=[];S.matches=[];S.byeMap={};});};
  const db2=el('button',{class:'press btn-red',style:{width:'100%',padding:'11px',borderRadius:'12px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}},'Alles löschen & neu starten');
  db2.onclick=()=>{if(confirm('ALLES löschen inkl. Spieler und Einstellungen? Kann nicht rückgängig gemacht werden.'))mut(()=>{S.events=[];S.evP=[];S.teams=[];S.matches=[];S.byeMap={};S.players=[];S.settings={ptsWin:3,ptsLoss:0};});};
  rc.appendChild(db1);rc.appendChild(db2);if(IS_ADMIN)s.appendChild(rc);
  return s;
};
