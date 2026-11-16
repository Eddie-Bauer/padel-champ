// Light and dark come from the design system's tokens; the app only says
// which one applies, with data-theme on <html>. index.html sets the stored
// choice before the first paint.
import {notify} from './store.js';

export const getTheme=()=>document.documentElement.dataset.theme==='dark'?'dark':'light';
export const setTheme=t=>{
  document.documentElement.dataset.theme=t;
  try{localStorage.setItem('pc_theme',t);}catch{}
  notify();
};
