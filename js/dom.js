// DOM helpers, icons and text formatting. No app state in here.

// h('button', {class:'pc-btn', onclick: fn}, icon('plus'), 'Neuer Padel Day')
// Props: class, text (as textContent), on<event>, style (object), any other
// attribute. `true` sets an empty attribute, null/false skips it. Children
// may be elements, strings, numbers, arrays, or null/false (skipped).
// Text always goes in as text, never as HTML.
export const h=(tag,props,...kids)=>{
  const e=document.createElement(tag);
  if(props)for(const [k,v] of Object.entries(props)){
    if(v==null||v===false)continue;
    if(k==='class')e.className=v;
    else if(k==='text')e.textContent=v;
    else if(k==='style')Object.assign(e.style,v);
    else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);
    else e.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat(Infinity)){
    if(c==null||c===false)continue;
    e.appendChild(typeof c==='string'||typeof c==='number'?document.createTextNode(String(c)):c);
  }
  return e;
};

// ─── Icons ────────────────────────────────────────────────────
// Line style of the design system: 24 viewBox, stroke currentColor, no fill.
const ICONS={
  plus:'<path d="M12 5v14M5 12h14"/>',
  minus:'<path d="M5 12h14"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  chevron:'<path d="M9 5l7 7-7 7"/>',
  lock:'<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  shuffle:'<path d="M3 7h3.5c4 0 5 10 9 10H21M3 17h3.5c1.6 0 2.7-1.6 3.6-3.6M13.9 9.6C14.8 8.1 15.8 7 17.5 7H21M18 4l3 3-3 3M18 14l3 3-3 3"/>',
  spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  settings:'<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.5"/><circle cx="8" cy="17" r="2.5"/>',
  download:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  calendar:'<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  trophy:'<path d="M8 21h8M12 16.5V21M7 3.5h10V9a5 5 0 0 1-10 0z"/><path d="M17 5h3v1.5A3.5 3.5 0 0 1 16.6 10M7 5H4v1.5A3.5 3.5 0 0 0 7.4 10"/>',
  people:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  pause:'<path d="M9 5v14M15 5v14"/>',
  undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
};
// The markup above is fixed text from this file, so parsing it is safe.
// `cls` is 'pc-icon' for normal icons, '' inside steppers and the + button
// (their own styles size the svg).
export const icon=(name,cls='pc-icon')=>{
  const t=document.createElement('template');
  t.innerHTML='<svg'+(cls?' class="'+cls+'"':'')+' viewBox="0 0 24 24" aria-hidden="true">'+ICONS[name]+'</svg>';
  return t.content.firstChild;
};

// ─── Buttons ──────────────────────────────────────────────────
// btn('primary', 'Speichern', fn, {icon:'plus', block:true})
export const btn=(variant,label,onclick,{icon:ic,block,pill,disabled,cls}={})=>h('button',{
  type:'button',
  class:'pc-btn pc-btn--'+variant+(block?' pc-btn--block':'')+(pill?' pc-btn--pill':'')+(cls?' '+cls:''),
  disabled:!!disabled,onclick,
},ic&&icon(ic),label);
// Icon-only button; the label is read by screen readers.
export const iconBtn=(variant,ic,label,onclick,cls)=>h('button',{
  type:'button',class:'pc-btn pc-btn--'+variant+' pc-btn--icon'+(cls?' '+cls:''),'aria-label':label,title:label,onclick,
},icon(ic));

// ─── Text ─────────────────────────────────────────────────────
const at=d=>new Date(d+'T12:00:00');
export const fmtDate=(d,opts)=>at(d).toLocaleDateString('de-CH',opts||{day:'numeric',month:'long',year:'numeric'});
// 16.11.2026
export const dmy=d=>at(d).toLocaleDateString('de-CH',{day:'2-digit',month:'2-digit',year:'numeric'});
// 16.11.
export const dm=d=>{const x=at(d);return String(x.getDate()).padStart(2,'0')+'.'+String(x.getMonth()+1).padStart(2,'0')+'.';};
export const weekday=d=>at(d).toLocaleDateString('de-CH',{weekday:'long'});
export const monthShort=d=>at(d).toLocaleDateString('de-CH',{month:'short'}).replace('.','');
export const dayOfMonth=d=>String(at(d).getDate()).padStart(2,'0');
export const ymd=d=>d.replace(/-/g,'');
export const today=()=>{const x=new Date();return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
// +9, −4 (real minus sign), 0
export const signed=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
export const first=name=>(name||'?').split(' ')[0];
export const initials=name=>(name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

// ─── Small shared pieces ──────────────────────────────────────
// The screen headline: optional overline and ONE highlighted word.
export const headline=(overline,before,hl,after)=>h('h1',{class:'pc-headline'},
  overline&&h('small',{text:overline}),before,hl&&h('span',{class:'pc-hl',text:hl}),after);
export const avatar=player=>h('span',{class:'app-avatar','aria-hidden':'true',text:initials(player.name)});
export const section=(title,action,...kids)=>h('section',{class:'app-section'},
  h('div',{class:'app-section__head'},h('h2',{class:'pc-overline',text:title}),action),kids);
export const badge=(variant,label,ic)=>h('span',{class:'pc-badge'+(variant?' pc-badge--'+variant:'')},ic&&icon(ic),label);
