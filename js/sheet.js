// Bottom sheets: focused tasks and confirmations.
import {h,btn,iconBtn} from './dom.js';

let seq=0;

// Opens a sheet. `body` and `foot` are elements or arrays of them.
// Returns {close, body}. Closes on Escape, on a tap outside, and on the X;
// focus goes to the first control and back to where it was on close.
export const openSheet=({title,body,foot,onClose})=>{
  const before=document.activeElement;
  const id='pc-sheet-'+(++seq);
  let open=true;
  const close=()=>{
    if(!open)return;
    open=false;
    document.removeEventListener('keydown',onKey);
    scrim.remove();
    if(onClose)onClose();
    if(before&&before.focus)before.focus();
  };
  const onKey=e=>{if(e.key==='Escape')close();};
  const closeBtn=iconBtn('ghost','close','Schließen',close);
  const bodyEl=h('div',{class:'pc-sheet__body'},body);
  const sheet=h('div',{class:'pc-sheet pc-enter',role:'dialog','aria-modal':'true','aria-labelledby':id},
    h('div',{class:'pc-sheet__grab'}),
    h('div',{class:'pc-sheet__head'},h('div',{class:'pc-sheet__title',id,text:title}),closeBtn),
    bodyEl,
    foot&&h('div',{class:'pc-sheet__foot'},foot));
  const scrim=h('div',{class:'pc-scrim',onclick:e=>{if(e.target===scrim)close();}},sheet);
  document.addEventListener('keydown',onKey);
  document.body.appendChild(scrim);
  const firstControl=sheet.querySelector('.pc-sheet__body input, .pc-sheet__body button:not([disabled]), .pc-sheet__foot button');
  (firstControl||closeBtn).focus();
  return{close,body:bodyEl};
};

// A question with "Abbrechen" and one action. Every destructive action in
// the app goes through this.
export const confirmSheet=({title,text,action,danger=false,onConfirm})=>{
  const s=openSheet({
    title,
    body:h('p',{class:'pc-muted',style:{margin:'0'},text}),
    foot:[
      btn('secondary','Abbrechen',()=>s.close()),
      btn(danger?'danger':'primary',action,()=>{s.close();onConfirm();}),
    ],
  });
  return s;
};
