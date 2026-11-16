// Spieler: everyone in the group, with their season line.
import {h,btn,iconBtn,headline,section,avatar} from '../dom.js';
import {S,IS_ADMIN,standings} from '../store.js';
import {addPlayer,setPlayerActive} from '../actions.js';
import {openSheet,confirmSheet} from '../sheet.js';

const openNewPlayer=()=>{
  const input=h('input',{class:'pc-input',type:'text',placeholder:'z. B. Anna',autocomplete:'off',maxlength:'40'});
  const field=h('label',{class:'pc-field'},
    h('span',{class:'pc-field__label',text:'Spielername'}),input,
    h('span',{class:'pc-field__hint',text:'Wird in Ranglisten und im Live View angezeigt.'}));
  const hint=field.lastChild;
  const add=()=>{
    const name=input.value.trim();
    if(!name){field.classList.add('pc-field--error');input.setAttribute('aria-invalid','true');hint.textContent='Bitte einen Namen eingeben.';return;}
    addPlayer(name);sheet.close();
  };
  input.addEventListener('keydown',e=>{if(e.key==='Enter')add();});
  const sheet=openSheet({
    title:'Neuer Spieler',
    body:field,
    foot:[btn('secondary','Abbrechen',()=>sheet.close()),btn('primary','Hinzufügen',add)],
  });
};

export const renderPlayers=()=>{
  const st=standings();
  const active=S.players.filter(p=>p.isActive),inactive=S.players.filter(p=>!p.isActive);
  const row=p=>{
    const x=st.find(r=>r.player.id===p.id);
    const line=x&&x.mp>0?x.pct+'% · Rang '+x.rank+' · '+x.w+' S '+x.l+' N':'Noch keine Spiele';
    return h('div',{class:'app-row'},
      avatar(p),
      h('span',{class:'app-row__text'},h('span',{class:'title-3',text:p.name}),h('span',{class:'body-sm pc-muted pc-num',text:line})),
      IS_ADMIN&&iconBtn('ghost','pause',p.name+' deaktivieren',()=>confirmSheet({
        title:'Spieler deaktivieren?',
        text:p.name+' erscheint nicht mehr in der Auswahl für neue Padel Days. Bisherige Ergebnisse bleiben erhalten, und du kannst die Person jederzeit reaktivieren.',
        action:'Deaktivieren',onConfirm:()=>setPlayerActive(p.id,false)})));
  };
  return h('main',{class:'app-screen pc-enter'},
    h('div',{class:'app-head'},headline(active.length+(active.length===1?' aktiver Spieler':' aktive Spieler'),'Alle ','Spieler')),
    active.length===0
      ?h('div',{class:'app-empty'},h('p',{style:{margin:'0'},text:'Noch keine Spieler angelegt.'}))
      :h('div',{class:'pc-card'},active.map(row)),
    IS_ADMIN&&h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
      btn('secondary','Spieler hinzufügen',openNewPlayer,{icon:'plus'})),
    IS_ADMIN&&inactive.length>0&&section('Inaktiv ('+inactive.length+')',null,
      h('div',{class:'pc-card'},inactive.map(p=>h('div',{class:'app-row app-row--dim'},
        avatar(p),
        h('span',{class:'app-row__text'},h('span',{class:'title-3',text:p.name})),
        btn('secondary','Reaktivieren',()=>setPlayerActive(p.id,true)))))));
};
