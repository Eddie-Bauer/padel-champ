import {notify} from './store.js';

// ─── Themes ───────────────────────────────────────────────────
export const THEMES={
  light:{bg:'#F0F2F5',surface:'#FFFFFF',border:'#E4E7EC',accent:'#2563EB',accentBg:'#EFF6FF',green:'#16A34A',greenBg:'#DCFCE7',orange:'#EA580C',orangeBg:'#FFF7ED',red:'#DC2626',redBg:'#FEF2F2',text:'#111827',sub:'#6B7280',muted:'#9CA3AF',divider:'#F3F4F6'},
  dark:{bg:'#0F1117',surface:'#1C1F26',border:'#2D3140',accent:'#3B82F6',accentBg:'#1E2A45',green:'#22C55E',greenBg:'#14291E',orange:'#F97316',orangeBg:'#2A1A0A',red:'#EF4444',redBg:'#2A1010',text:'#F1F5F9',sub:'#94A3B8',muted:'#64748B',divider:'#1E2130'}
};
export const _savedTheme=localStorage.getItem('pc_theme')||'light';
export const C=Object.assign({},THEMES[_savedTheme]);
export const setTheme=(t)=>{Object.assign(C,THEMES[t]);localStorage.setItem('pc_theme',t);if(typeof applyThemeCss==='function')applyThemeCss();document.body.style.background=C.bg;document.getElementById('root').style.background=C.bg;notify();};
document.body.style.background=C.bg;
document.getElementById('root').style.background=C.bg;
export const _themeStyle=document.createElement('style');
document.head.appendChild(_themeStyle);
export const applyThemeCss=()=>{
  _themeStyle.textContent=`
    body{background:${C.bg}!important;}
    #root{background:${C.bg}!important;}
    #nav{background:${C.surface}!important;border-top-color:${C.border}!important;}
    .navbtn{color:${C.muted}!important;}
    .navbtn.active{color:${C.accent}!important;}
    .card{background:${C.surface}!important;border-color:${C.border}!important;}
    .matchcard{background:${C.surface}!important;border-color:${C.border}!important;}
    .evcard{background:${C.surface}!important;border-color:${C.border}!important;}
    .teamcard{background:${C.surface}!important;border-color:${C.border}!important;}
    .modal{background:${C.surface}!important;}
    .modal-scroll{background:${C.surface}!important;}
    .overlay{background:#00000080!important;}
    input[type=text],input[type=date]{background:${C.bg}!important;border-color:${C.border}!important;color:${C.text}!important;}
    input[type=text]:focus,input[type=date]:focus{border-color:${C.accent}!important;}
    hr{border-top-color:${C.divider}!important;}
    .screen{background:${C.bg}!important;}
  `;
};
applyThemeCss();
