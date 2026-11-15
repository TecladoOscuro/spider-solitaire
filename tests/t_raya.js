const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/tres-en-raya.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitAI(p){
  const t0=Date.now();
  while(Date.now()-t0<8000){
    const s=await p.evaluate(()=>({turn:state.turn,over:state.over,n:state.board.filter(Boolean).length}));
    if(s.over||s.n>=2&&state0(s)) return s;
    if(s.turn==='x'||s.over) return s;
    await sleep(150);
  }
  return null;
}
function state0(s){return s.n>=2;} // jugada IA ya pintada
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
p.setDefaultTimeout(8000);
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));
await p.goto(URL);await sleep(550);

// 1 layout + globals
const l=await p.evaluate(()=>({
  cells:document.querySelectorAll('#board .cell[data-i]').length,
  turn:state.turn, legal:legalMoves(state).length,
  gen:typeof applyMove==='function'&&typeof chooseMove==='function'&&typeof winnerLine==='function'
}));
ok('9 casillas, turno x, motor',l.cells===9&&l.turn==='x'&&l.legal===9&&l.gen,l);

// 2 juega -> IA responde
await p.click('#board .cell[data-i="4"]');await sleep(600);
const r=await p.evaluate(()=>({n:state.board.filter(Boolean).length,turn:state.turn,
  x:state.board.filter(v=>v==='x').length,o:state.board.filter(v=>v==='o').length}));
ok('IA contesta (x + o pintados)',r.x===1&&r.o===1,r);

// 3 deshacer
await p.click('#btnUndo');await sleep(350);
const und=await p.evaluate(()=>({n:state.board.filter(Boolean).length,turn:state.turn}));
ok('deshacer revierte el par',und.n===0&&und.turn==='x',und);

// 4 dificultad
await p.selectOption('#diffSel','3');await sleep(400);
const d3=await p.evaluate(()=>({ls:localStorage.getItem('ttt.diff'),n:state.board.filter(Boolean).length}));
ok('dificultad persiste y reinicia',d3.ls==='3'&&d3.n===0,d3);

// 5 victoria forzada (tablero trucado + clic)
await p.evaluate(()=>{ state.board=['x','x',null,'o','o',null,null,null,null]; state.turn='x'; state.over=false; state.line=null; });
await sleep(150);
await p.click('#board .cell[data-i="2"]');
let shown=false;
const tw=Date.now();
while(Date.now()-tw<5000){
  if(await p.evaluate(()=>document.querySelector('#win').classList.contains('show'))){shown=true;break;}
  await sleep(200);
}
const win=await p.evaluate(()=>({over:state.over,res:state.result,line:state.line,
  show:document.querySelector('#win').classList.contains('show'),
  strike:document.querySelector('#strike line').getAttribute('x1')}));
win.show=win.show||shown;
ok('linea de3 -> over + overlay + trazo',win.over&&win.res==='x'&&win.line&&win.line.length===3&&win.show,win);

await p.screenshot({path:'/tmp/vis_raya.png',fullPage:false});
await p.click('#btnAgain');await sleep(350);
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`RAYA: ${fails} FAIL`:'RAYA: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
