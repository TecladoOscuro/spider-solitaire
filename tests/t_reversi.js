const {chromium}=require('playwright');
const URL=process.argv[2]||'http://localhost:8899/reversi.html';
let fails=0;
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' -> '+JSON.stringify(x)));if(!c)fails++;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitTurn(p,turn,ms){
  const t0=Date.now();
  while(Date.now()-t0<ms){
    const s=await p.evaluate(()=>({t:state.turn,over:state.over}));
    if(s.over||s.t===turn) return true;
    await sleep(120);
  }
  return false;
}
(async()=>{
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept().catch(()=>{}));
await p.goto(URL);await p.waitForTimeout(450);

// 1 globals + estado inicial
const l=await p.evaluate(()=>({
  cells:document.querySelectorAll('#board [data-i]').length,
  discs:countDiscs(state), turn:state.turn,
  legal:legalMoves(state).length,
  dots:document.querySelectorAll('#board .legal,#board [class*=legal]').length,
  gen:typeof flipsFor==='function'&&typeof applyMove==='function'&&typeof chooseMove==='function'
}));
ok('64 casillas',l.cells===64,l);
ok('inicial 2-2, turno negras,4 legales',l.discs.b===2&&l.discs.w===2&&l.turn==='b'&&l.legal===4,l);
ok('puntos de jugada legal visibles',l.dots===4,l.dots);
ok('motor global',l.gen,l);

// 2 juega negras -> IA responde
const mv=await p.evaluate(()=>legalMoves(state)[0]);
await p.click(`#board [data-i="${mv}"]`);await sleep(350);
const afterPlayer=await p.evaluate(()=>({t:state.turn,d:countDiscs(state)}));
ok('negra coloca y voltea',afterPlayer.d.b>2&&afterPlayer.d.b+afterPlayer.d.w===5,afterPlayer);
const aiDone=await waitTurn(p,'b',8000);
ok('IA blancas responde',aiDone,await p.evaluate(()=>({t:state.turn,d:countDiscs(state)})));
const afterAI=await p.evaluate(()=>({t:state.turn,d:countDiscs(state)}));
ok('IA coloca y voltea (6 discos)',afterAI.d.b+afterAI.d.w===6&&afterAI.t==='b',afterAI);

// 3 deshacer
await p.click('#btnUndo');await sleep(400);
const und=await p.evaluate(()=>({t:state.turn,d:countDiscs(state)}));
ok('deshacer vuelve al inicio',und.t==='b'&&und.d.b===2&&und.d.w===2,und);

// 4 pista
await p.click('#btnHint');await sleep(300);
const hint=await p.evaluate(()=>({toast:document.querySelector('#toast').classList.contains('show'),hl:document.querySelectorAll('#board .hint,#board [class*=hint]').length}));
ok('pista avisa o resalta',hint.toast||hint.hl>0,hint);

// 5 dificultad facil
await p.selectOption('#diffSel','1');await sleep(400);
const d1=await p.evaluate(()=>({ls:localStorage.getItem('oth.diff'),t:state.turn,d:countDiscs(state)}));
ok('facil persiste y reinicia',d1.ls==='1'&&d1.t==='b'&&d1.d.b===2,d1);

// 6 partida completa
let plies=0;
while(plies++<120){
  const st=await p.evaluate(()=>({over:state.over,t:state.turn}));
  if(st.over) break;
  if(st.t==='b'){
    const m=await p.evaluate(()=>{const L=legalMoves(state);return L.length?L[0]:null;});
    if(m===null){ await sleep(300); continue; }
    await p.click(`#board [data-i="${m}"]`);
    await sleep(200);
    await waitTurn(p,'b',8000);
  } else await sleep(300);
}
const shown=await (async()=>{
  const t0=Date.now();
  while(Date.now()-t0<9000){
    if(await p.evaluate(()=>document.querySelector('#win').classList.contains('show'))) return true;
    await sleep(200);
  }
  return false;
})();
const fin=await p.evaluate(()=>{
  const d=countDiscs(state);
  return {over:state.over,result:state.result,d,show:document.querySelector('#win').classList.contains('show'),
    count:document.querySelector('#winCount').textContent};
});
ok('partida completa termina',fin.over&&['b','w','draw'].includes(fin.result),fin);
const nums=(fin.count.match(/\d+/g)||[]);
ok('overlay victoria con recuento (tras animaciones)',shown&&fin.show&&nums.length>=2,{shown,show:fin.show,count:fin.count,nums});
const okResult=fin.over&&fin.result==='draw' ? fin.d.b===fin.d.w :
  (fin.result==='b'? fin.d.b>fin.d.w : fin.d.w>fin.d.b);
ok('resultado coherente con recuento',okResult,fin);

await p.screenshot({path:'/tmp/vis_reversi_win.png',fullPage:false});
await p.click('#btnAgain');await sleep(350);
await p.screenshot({path:'/tmp/vis_reversi.png',fullPage:false});
await p.click('.top a.brand');await sleep(450);
ok('logo lleva al indice',(await p.title())==='Juegos',await p.title());
ok('sin errores JS',errs.length===0,errs);
console.log(fails?`REVERSI: ${fails} FAIL`:'REVERSI: ALL PASS');
await b.close();
process.exit(fails?1:0);
})().catch(e=>{console.error('CRASH',e);process.exit(2);});
