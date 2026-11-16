// Rangliste: the season table.
import {h,btn,headline,first,signed} from '../dom.js';
import {S,IS_PLAYER,activeSeason,displaySeason,standings,notify} from '../store.js';
import {exportCSV} from '../actions.js';
import {openKiAnalyse} from './ki.js';

const COLS=[
  ['#','Rang','c-rank'],['Spieler','Spieler','c-name'],['Sp','Spiele','c-opt'],['S','Siege',''],
  ['N','Niederlagen',''],['%','Siegquote','c-opt'],['Diff','Satzdifferenz',''],['Pkt','Punkte','c-pts'],
];

const table=st=>h('div',{class:'pc-card',style:{overflow:'hidden'}},
  h('table',{class:'pc-standings'},
    h('thead',null,h('tr',null,COLS.map(([abbr,word,cls])=>
      h('th',{class:cls||null,title:word,scope:'col',style:cls==='c-name'?{textAlign:'left'}:null,text:abbr})))),
    h('tbody',null,st.map((x,i)=>h('tr',{class:i===0&&x.mp>0?'is-leader':null},
      h('td',{class:'c-rank'},h('b',{text:String(x.rank)})),
      h('td',{class:'c-name',text:x.player.name}),
      h('td',{class:'c-opt',text:String(x.mp)}),
      h('td',{text:String(x.w)}),
      h('td',{text:String(x.l)}),
      h('td',{class:'c-opt',text:x.pct+'%'}),
      h('td',{class:x.sd>0?'is-pos':x.sd<0?'is-neg':null,text:signed(x.sd)}),
      h('td',{class:'c-pts',text:String(x.pts)}))))));

export const renderStandings=()=>{
  const ds=displaySeason();
  const st=standings();
  const leader=st[0]&&st[0].mp>0?st[0]:null;
  return h('main',{class:'app-screen pc-enter'},
    h('div',{class:'app-head'},
      leader?headline(ds.name,null,first(leader.player.name),' führt'):headline(ds.name,null,'Rangliste')),
    S.seasons.length>1&&h('div',{class:'pc-row',style:{marginBottom:'var(--space-4)'},role:'group','aria-label':'Saison'},
      S.seasons.map(ss=>h('button',{type:'button',class:'pc-chip app-chip-text','aria-pressed':String(ds.id===ss.id),
        onclick:()=>{S.selSeason=ss.id===activeSeason().id?null:ss.id;notify();},text:ss.name}))),
    st.length===0
      ?h('div',{class:'app-empty'},h('p',{style:{margin:'0'},text:'Noch keine Ergebnisse in dieser Saison.'}))
      :[table(st),
        h('p',{class:'app-note pc-num',text:'Sieg = '+S.settings.ptsWin+' Pkt · Niederlage = '+(S.settings.ptsLoss||0)+' Pkt · Diff = Satzdifferenz'}),
        h('div',{class:'app-actions',style:{marginTop:'var(--space-4)'}},
          IS_PLAYER&&btn('secondary','KI-Analyse',openKiAnalyse,{icon:'spark',pill:true}),
          btn('secondary','Als CSV exportieren',exportCSV,{icon:'download'}))]);
};
