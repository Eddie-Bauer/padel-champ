import {C} from './theme.js';
import {colorIndex} from './logic.js';

// ─── Avatar colours ───────────────────────────────────────────
export const ABG=['#DBEAFE','#D1FAE5','#FEE2E2','#FEF3C7','#EDE9FE','#FCE7F3','#CFFAFE','#F3F4F6'];
export const AFG=['#1D4ED8','#065F46','#991B1B','#92400E','#5B21B6','#9D174D','#164E63','#374151'];
export const abg=id=>ABG[colorIndex(id,ABG.length)];
export const afg=id=>AFG[colorIndex(id,AFG.length)];
export const ini=n=>(n||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

export const fmtDate=(d,opts)=>new Date(d+'T12:00:00').toLocaleDateString('de-CH',opts||{day:'numeric',month:'long',year:'numeric'});
export const fmtDateShort=d=>new Date(d+'T12:00:00').toLocaleDateString('de-CH',{weekday:'long',day:'numeric',month:'long'});
export const ymd=d=>d.replace(/-/g,'');
export const el=(tag,attrs,inner)=>{const e=document.createElement(tag);if(attrs)Object.entries(attrs).forEach(([k,v])=>{if(k==='style'&&typeof v==='object')Object.assign(e.style,v);else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);else e.setAttribute(k,v);});if(inner!=null){if(typeof inner==='string')e.innerHTML=inner;else if(Array.isArray(inner))inner.filter(Boolean).forEach(c=>e.appendChild(typeof c==='string'?Object.assign(document.createTextNode(c)):c));else e.appendChild(inner);}return e;};
export const div=(cls,style,children)=>{const d=document.createElement('div');if(cls)d.className=cls;if(style)Object.assign(d.style,style);if(children){if(Array.isArray(children))children.filter(Boolean).forEach(c=>{if(c)d.appendChild(typeof c==='string'?document.createTextNode(c):c);});else if(typeof children==='string')d.textContent=children;else d.appendChild(children);}return d;};
export const span=(txt,style)=>{const s=document.createElement('span');s.textContent=txt;if(style)Object.assign(s.style,style);return s;};
export const txt=t=>document.createTextNode(t);

// ─── Avatar component ─────────────────────────────────────────
export const mkAvatar=(player,size=36)=>{
  const d=document.createElement('div');
  Object.assign(d.style,{width:size+'px',height:size+'px',borderRadius:size/2+'px',background:abg(player.id),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:'0'});
  const s=document.createElement('span');s.textContent=ini(player.name);
  Object.assign(s.style,{fontSize:size*.36+'px',fontWeight:'700',color:afg(player.id),lineHeight:'1'});
  d.appendChild(s);return d;
};

// ─── Render helpers ───────────────────────────────────────────
export const sectionHeader=(title,actionEl)=>{
  const h=div('',{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'});
  h.appendChild(span(title,{fontSize:'12px',fontWeight:'600',color:C.muted,letterSpacing:'.5px'}));
  if(actionEl)h.appendChild(actionEl);return h;
};

export const mkRndBtn=(label,icon,onclick,primary)=>{
  const b=document.createElement('button');b.className='press';b.textContent=(icon?icon+' ':'')+label;
  Object.assign(b.style,{background:primary?C.accent:C.bg,color:primary?'#fff':C.sub,border:primary?'none':'1px solid '+C.border,borderRadius:'10px',padding:'10px 16px',fontSize:'14px',fontWeight:'700',cursor:'pointer',display:'inline-flex',alignItems:'center',gap:'6px'});
  b.onclick=onclick;return b;
};
