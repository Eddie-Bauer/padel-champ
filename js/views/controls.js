// Small controls shared by setup screens.
import {h,icon} from '../dom.js';

// A labelled number with minus and plus. Calls onPick with the new value.
export const valueStepper=(label,value,min,max,onPick,hint)=>{
  const step=(d,word,cls,ic,off)=>h('button',{type:'button',class:'pc-stepper__btn'+cls,'aria-label':label+' '+word,disabled:off,
    onclick:()=>onPick(value+d)},icon(ic,''));
  return h('div',null,
    h('div',{class:'pc-stepper__team',text:label}),
    h('div',{class:'pc-stepper'},
      step(-1,'minus eins','','minus',value<=min),
      h('output',{class:'pc-stepper__value','aria-live':'polite',text:String(value)}),
      step(1,'plus eins',' pc-stepper__btn--plus','plus',value>=max)),
    hint&&h('p',{class:'app-note',text:hint}));
};

// A pill switch. options: [[value, label], ...]
export const segmented=(label,options,current,onPick)=>h('div',{class:'pc-seg',role:'tablist','aria-label':label},
  options.map(([value,text])=>h('button',{type:'button',role:'tab','aria-selected':String(value===current),
    onclick:()=>{if(value!==current)onPick(value);},text})));

// A labelled group of anything.
export const labelled=(label,control)=>h('div',null,h('div',{class:'pc-stepper__team',text:label}),control);
